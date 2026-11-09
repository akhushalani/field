import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";

import { applyModelPatch } from "./core";
import { proposeBoardUpdate } from "./model";

test("SDK structured output becomes an evidence-backed patch without provider calls", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            upserts: [
              {
                id: "screen",
                text: "Use one shared screen",
                kind: "decision",
                topic: "Room",
                sourceIds: ["source"],
              },
            ],
            removeIds: [],
          }),
        },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
  const board = { meetingId: "meeting", revision: 0, ideas: [] };
  const evidence = [
    { id: "source", text: "Let’s use one screen", startMs: 0, endMs: 1000 },
  ];
  const patch = await proposeBoardUpdate(
    model,
    board,
    evidence,
    true,
    new AbortController().signal,
  );
  const next = applyModelPatch(
    board,
    patch,
    new Map(evidence.map((item) => [item.id, item])),
  );
  expect(next.ideas[0]?.text).toBe("Use one shared screen");
  expect(next.ideas[0]?.sourceIds).toEqual(["source"]);
  expect(next.revision).toBe(1);
}, 20_000);
