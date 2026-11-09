import { expect, test } from "vitest";

import {
  applyModelPatch,
  editIdea,
  hideIdea,
  releaseIdea,
  type Board,
  type ModelPatch,
} from "./core";

test("conversation updates preserve corrections, hidden ideas and earlier revisions", () => {
  const evidence = new Map([
    [
      "word-1",
      { id: "word-1", text: "Explore a room display", startMs: 0, endMs: 1000 },
    ],
    [
      "word-2",
      { id: "word-2", text: "Use one host Mac", startMs: 2000, endMs: 3000 },
    ],
  ]);
  const initial: Board = { meetingId: "meeting-a", revision: 0, ideas: [] };
  const patch: ModelPatch = {
    meetingId: "meeting-a",
    baseRevision: 0,
    removeIds: [],
    upserts: [
      {
        id: "display",
        text: "Room display",
        kind: "idea",
        topic: "Room",
        sourceIds: ["word-1"],
      },
    ],
  };
  const first = applyModelPatch(initial, patch, evidence);
  const corrected = editIdea(
    first,
    "display",
    "One shared display, controlled by the host",
  );
  expect(() => applyModelPatch(corrected, patch, evidence)).toThrow(
    "Board changed",
  );
  const next = applyModelPatch(
    corrected,
    { ...patch, baseRevision: corrected.revision },
    evidence,
  );
  expect(next.ideas[0]?.text).toBe(
    "One shared display, controlled by the host",
  );
  const hidden = hideIdea(next, "display");
  const replayed = applyModelPatch(
    hidden,
    { ...patch, baseRevision: hidden.revision },
    evidence,
  );
  expect(replayed.ideas[0]?.hidden).toBe(true);
  expect(first.ideas[0]?.text).toBe("Room display");
  expect(initial.ideas).toEqual([]);
  expect(() =>
    applyModelPatch(
      first,
      { ...patch, meetingId: "meeting-b", baseRevision: 1 },
      evidence,
    ),
  ).toThrow();
  expect(() =>
    applyModelPatch(
      first,
      {
        ...patch,
        baseRevision: 1,
        upserts: [{ ...patch.upserts[0]!, sourceIds: ["invented"] }],
      },
      evidence,
    ),
  ).toThrow("evidence");
  expect(first.revision).toBe(1);
  const archived = applyModelPatch(
    first,
    { ...patch, baseRevision: 1, upserts: [], removeIds: ["display"] },
    evidence,
  );
  const revived = applyModelPatch(
    archived,
    { ...patch, baseRevision: 2 },
    evidence,
  );
  expect(revived.ideas[0]?.hidden).toBe(false);
  const released = releaseIdea(corrected, "display");
  const revised = applyModelPatch(
    released,
    {
      ...patch,
      baseRevision: released.revision,
      upserts: [{ ...patch.upserts[0]!, topic: "Pilot setup" }],
    },
    evidence,
  );
  expect(revised.ideas[0]?.topic).toBe("Pilot setup");
});
