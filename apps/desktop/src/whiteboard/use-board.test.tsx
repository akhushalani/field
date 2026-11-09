import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type { Board, ModelPatch } from "./core";
import { useBoard } from "./use-board";

const mocks = vi.hoisted(() => ({
  model: {},
  propose: vi.fn(),
  persist: vi.fn().mockResolvedValue(undefined),
  history: [] as Board[],
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
  readBoardHistory: async () => mocks.history,
  persistBoard: mocks.persist,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.history = [];
  mocks.transcripts = [
    {
      id: "transcript",
      startedAt: 1000,
      words: [
        { id: "w1", text: "Use one shared screen", start_ms: 0, end_ms: 1000 },
      ],
    },
  ];
});

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

test("a source correction invalidates a late removal as well as a late upsert", async () => {
  mocks.history = [
    {
      meetingId: "meeting",
      revision: 1,
      ideas: [
        {
          id: "screen",
          text: "Use one shared screen",
          topic: "Room",
          kind: "idea",
          sourceIds: ["transcript:w1"],
          edited: false,
          hidden: false,
        },
      ],
    },
  ];
  let complete!: (patch: ModelPatch) => void;
  mocks.propose.mockImplementation(
    () =>
      new Promise<ModelPatch>((resolve) => {
        complete = resolve;
      }),
  );
  const { result, rerender, unmount } = renderHook(() =>
    useBoard("meeting", true),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.toggle());
  await waitFor(() => expect(mocks.propose).toHaveBeenCalledOnce());
  mocks.transcripts = [
    {
      ...mocks.transcripts[0]!,
      words: [
        {
          id: "w1",
          text: "Use individual screens instead",
          start_ms: 0,
          end_ms: 1000,
        },
      ],
    },
  ];
  rerender();
  await act(async () =>
    complete({
      meetingId: "meeting",
      baseRevision: 1,
      upserts: [],
      removeIds: ["screen"],
    }),
  );
  expect(result.current.board.ideas[0]?.hidden).toBe(false);
  expect(result.current.board.revision).toBe(1);
  expect(mocks.persist).not.toHaveBeenCalled();
  unmount();
}, 20_000);

test.each(["append", "correct"] as const)(
  "a late result handles %s speech without confusing it with a correction",
  async (change) => {
    let complete!: (patch: ModelPatch) => void;
    mocks.propose.mockImplementation(
      () =>
        new Promise<ModelPatch>((resolve) => {
          complete = resolve;
        }),
    );
    const { result, rerender, unmount } = renderHook(() =>
      useBoard("meeting", true),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.toggle());
    await waitFor(() => expect(mocks.propose).toHaveBeenCalledOnce());
    const original = mocks.transcripts[0]!;
    mocks.transcripts = [
      {
        ...original,
        words:
          change === "append"
            ? [
                ...original.words,
                {
                  id: "w2",
                  text: "controlled by the host",
                  start_ms: 1000,
                  end_ms: 2000,
                },
              ]
            : [
                {
                  ...original.words[0]!,
                  text: "Use individual screens instead",
                },
              ],
      },
    ];
    rerender();
    await act(async () =>
      complete({
        meetingId: "meeting",
        baseRevision: 0,
        upserts: [
          {
            id: "screen",
            text: "Use one shared screen",
            topic: "Room",
            kind: "idea",
            sourceIds: ["transcript:w1"],
          },
        ],
        removeIds: [],
      }),
    );
    expect(result.current.board.ideas).toHaveLength(
      change === "append" ? 1 : 0,
    );
    expect(mocks.persist).toHaveBeenCalledTimes(change === "append" ? 1 : 0);
    unmount();
  },
  20_000,
);
