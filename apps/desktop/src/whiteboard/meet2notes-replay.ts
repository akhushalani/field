import { z } from "zod";

import type { Evidence } from "./core";

const batchSchema = z.object({
  type: z.literal("com.meet2notes.live.segment.batch.v1"),
  data: z.object({
    meeting: z.object({ id: z.number().int() }),
    sequence: z.number().int().positive(),
    segments: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string(),
          start_ms: z.number().nonnegative(),
          end_ms: z.number().nonnegative(),
        }),
      )
      .max(1000),
  }),
});

export type ReplayState = {
  meetingId: number;
  startedAt: number;
  sequence: number;
  evidence: Evidence[];
};

/** Offline fixture adapter; it does not expose an incoming webhook endpoint. */
export function applyMeet2NotesBatch(
  state: ReplayState,
  event: unknown,
): ReplayState {
  const { data } = batchSchema.parse(event);
  if (data.meeting.id !== state.meetingId)
    throw new Error("Replay belongs to another meeting");
  if (data.sequence <= state.sequence) return state;
  if (data.sequence !== state.sequence + 1)
    throw new Error("Missing replay batch");
  const sources = new Map(state.evidence.map((item) => [item.id, item]));
  for (const segment of data.segments) {
    if (segment.end_ms < segment.start_ms)
      throw new Error("Invalid replay timestamps");
    const id = `meet2notes:${state.meetingId}:${segment.id}`;
    sources.set(id, {
      id,
      text: segment.text,
      startMs: state.startedAt + segment.start_ms,
      endMs: state.startedAt + segment.end_ms,
    });
  }
  return {
    ...state,
    sequence: data.sequence,
    evidence: [...sources.values()].sort((a, b) => a.startMs - b.startMs),
  };
}
