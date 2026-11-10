import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";

import { applyModelPatch, editDiscussion, type Board } from "./core";
import { DiscussionRegion } from "./discussion";

const board: Board = {
  meetingId: "test",
  revision: 1,
  ideas: [
    {
      id: "shared",
      label: "Shared screen",
      text: "One screen in the room",
      topic: "Pilot",
      kind: "decision",
      sourceIds: ["s"],
      edited: false,
      hidden: false,
    },
    {
      id: "devices",
      label: "Individual devices",
      text: "Each person has a screen",
      topic: "Pilot",
      kind: "idea",
      sourceIds: ["s"],
      edited: false,
      hidden: false,
    },
    {
      id: "flow",
      label: "No setup interruption",
      text: "Avoid interrupting the conversation for setup",
      topic: "Pilot",
      kind: "idea",
      sourceIds: ["s"],
      edited: false,
      hidden: false,
    },
  ],
  discussion: {
    title: "Which screen setup?",
    mode: "explore",
    ideaIds: ["shared", "devices", "flow"],
    options: ["shared", "devices"],
    links: [{ from: "flow", to: "shared", kind: "supports" }],
    decisionId: "shared",
    edited: false,
  },
};

test("one discussion retains its relationships through comparison, decision and exploration", () => {
  function Host() {
    const [current, setCurrent] = useState(board);
    return (
      <DiscussionRegion
        board={current}
        disabled={false}
        onChange={(r) => setCurrent(editDiscussion(current, r))}
        onRelease={() => {}}
        onSelect={() => {}}
      />
    );
  }
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "Compare" }));
  expect(
    within(screen.getByRole("region", { name: "Shared screen" })).getByRole(
      "button",
      { name: "No setup interruption" },
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Decision" }));
  expect(
    screen
      .getByRole("button", { name: "Decision" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByText("supports")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Explore" }));
  expect(screen.getByRole("group", { name: "Exploration map" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Release structure" }),
  ).toBeTruthy();
}, 20_000);

test("model cannot replace a host structure and malformed relationships cannot be saved", () => {
  const protectedBoard = editDiscussion(board, {
    ...board.discussion!,
    mode: "compare",
  });
  const next = applyModelPatch(
    protectedBoard,
    {
      meetingId: "test",
      baseRevision: 2,
      upserts: [],
      removeIds: [],
      discussion: { ...board.discussion!, mode: "decide" },
    },
    new Map(),
  );
  expect(next.discussion).toEqual(protectedBoard.discussion);
  expect(() =>
    editDiscussion(board, {
      ...board.discussion!,
      links: [{ from: "unknown", to: "shared", kind: "supports" }],
    }),
  ).toThrow();
  expect(() =>
    editDiscussion(board, {
      ...board.discussion!,
      decisionId: "flow",
      mode: "decide",
    }),
  ).toThrow();
});
