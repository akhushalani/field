import { expect, test } from "vitest";

import { applyModelPatch } from "./core";
import { applyMeet2NotesBatch, type ReplayState } from "./meet2notes-replay";
import fixture from "./meet2notes.fixture.jsonl?raw";

test("real Meet2Notes serialization replays corrections through the shared board engine", () => {
  const events: unknown[] = fixture
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const empty: ReplayState = {
    meetingId: 7,
    startedAt: 0,
    sequence: 0,
    evidence: [],
  };
  const beforeCorrection = events
    .slice(0, 2)
    .reduce<ReplayState>(applyMeet2NotesBatch, empty);
  expect(beforeCorrection.evidence[1]?.text).toContain("phone");
  const replayed = events.reduce<ReplayState>(applyMeet2NotesBatch, empty);
  expect(replayed.evidence).toHaveLength(3);
  expect(replayed.evidence[1]?.text).toContain("Mac");
  expect(applyMeet2NotesBatch(replayed, events[2])).toBe(replayed);
  expect(() => applyMeet2NotesBatch(empty, events[2])).toThrow(
    "Missing replay batch",
  );
  expect(() =>
    applyMeet2NotesBatch({ ...empty, meetingId: 8 }, events[0]),
  ).toThrow("another meeting");
  const board = applyModelPatch(
    { meetingId: "native-session", revision: 0, ideas: [] },
    {
      meetingId: "native-session",
      baseRevision: 0,
      removeIds: [],
      upserts: [
        {
          id: "host",
          text: "Host controls from their Mac",
          topic: "Room",
          kind: "idea",
          sourceIds: ["meet2notes:7:live-11-1"],
        },
      ],
    },
    new Map(replayed.evidence.map((item) => [item.id, item])),
  );
  expect(board.ideas[0]?.text).toContain("Mac");
});
