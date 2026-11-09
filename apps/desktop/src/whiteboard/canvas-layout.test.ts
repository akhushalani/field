import ELK from "elkjs/lib/elk.bundled.js";
import { expect, test } from "vitest";

import { layoutBoard } from "./canvas-layout";
import type { Board } from "./core";

test("ELK groups visible ideas without overlap and follows semantic regrouping", async () => {
  const board: Board = {
    meetingId: "meeting",
    revision: 1,
    ideas: [
      {
        id: "topic:Room",
        text: "One shared screen",
        topic: "Room",
        kind: "decision",
        sourceIds: ["source"],
        edited: true,
        hidden: false,
      },
      {
        id: "controls",
        text: "Host controls",
        topic: "Room",
        kind: "idea",
        sourceIds: ["source"],
        edited: false,
        hidden: false,
      },
      {
        id: "storage",
        text: "Local storage",
        topic: "Privacy",
        kind: "decision",
        sourceIds: ["source"],
        edited: false,
        hidden: false,
      },
      {
        id: "hidden",
        text: "Hidden idea",
        topic: "Room",
        kind: "idea",
        sourceIds: ["source"],
        edited: true,
        hidden: true,
      },
    ],
  };
  const sizes = new Map(
    board.ideas.map((idea) => [idea.id, { width: 320, height: 140 }]),
  );
  const engine = new ELK();
  const first = await layoutBoard(board, sizes, engine);
  expect(first.cards.map((card) => card.id).sort()).toEqual([
    "controls",
    "storage",
    "topic:Room",
  ]);
  for (const [index, card] of first.cards.entries()) {
    for (const other of first.cards.slice(index + 1)) {
      expect(
        card.x + 320 <= other.x ||
          other.x + 320 <= card.x ||
          card.y + 140 <= other.y ||
          other.y + 140 <= card.y,
      ).toBe(true);
    }
  }
  const regrouped = await layoutBoard(
    {
      ...board,
      ideas: board.ideas.map((idea) =>
        idea.id === "controls" ? { ...idea, topic: "Privacy" } : idea,
      ),
    },
    sizes,
    engine,
  );
  expect(regrouped.groups.map((group) => group.title).sort()).toEqual([
    "Privacy",
    "Room",
  ]);
  expect(first.cards.find((card) => card.id === "controls")?.topic).toBe(
    "Room",
  );
  expect(regrouped.cards.find((card) => card.id === "controls")?.topic).toBe(
    "Privacy",
  );
}, 20_000);
