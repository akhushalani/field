import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { ModelPatch } from "./core";
import { useBoard } from "./use-board";

const mocks = vi.hoisted(() => ({
  model: {},
  propose: vi.fn(),
  persist: vi.fn().mockResolvedValue(undefined),
  transcripts: [
    {
      id: "transcript",
      startedAt: 1000,
      words: [
        { id: "w1", text: "Use one shared screen", start_ms: 0, end_ms: 1000 },
      ],
    },
  ],
}));
vi.mock("~/ai/hooks/useLLMConnection", () => ({
  useLanguageModel: () => mocks.model,
  useLLMConnection: () => ({ status: { status: "success", isHosted: false } }),
}));
vi.mock("~/stt/queries", () => ({
  useSessionTranscripts: () => mocks.transcripts,
}));
vi.mock("./model", () => ({ proposeBoardUpdate: mocks.propose }));
vi.mock("./storage", () => ({
  readBoardHistory: async () => [],
  persistBoard: mocks.persist,
}));

test("pausing cancels an in-flight update and ignores its late result", async () => {
  let complete!: (patch: ModelPatch) => void;
  mocks.propose.mockImplementation(
    () =>
      new Promise<ModelPatch>((resolve) => {
        complete = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useBoard("meeting", true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(mocks.propose).not.toHaveBeenCalled();
  act(() => result.current.toggle());
  await waitFor(() => expect(mocks.propose).toHaveBeenCalledOnce());
  const signal = mocks.propose.mock.calls[0]![4] as AbortSignal;
  act(() => result.current.toggle());
  expect(signal.aborted).toBe(true);
  await act(async () =>
    complete({
      meetingId: "meeting",
      baseRevision: 0,
      upserts: [
        {
          id: "screen",
          text: "Use one screen",
          topic: "Room",
          kind: "decision",
          sourceIds: ["transcript:w1"],
        },
      ],
      removeIds: [],
    }),
  );
  expect(mocks.persist).not.toHaveBeenCalled();
  expect(result.current.board.ideas).toEqual([]);
  unmount();
}, 20_000);
