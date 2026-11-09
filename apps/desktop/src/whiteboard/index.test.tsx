import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { MeetingBoard } from ".";

const actions = vi.hoisted(() => ({
  edit: vi.fn(),
  hide: vi.fn(),
  toggle: vi.fn(),
  undo: vi.fn(),
}));
vi.mock("./use-board", () => ({
  useBoard: () => ({
    ...actions,
    ready: true,
    providerReady: true,
    busy: false,
    running: true,
    updating: false,
    error: null,
    canUndo: true,
    board: {
      meetingId: "meeting",
      revision: 2,
      ideas: [
        {
          id: "display",
          text: "One shared display",
          topic: "Meeting room",
          kind: "decision",
          sourceIds: ["source"],
          edited: false,
          hidden: false,
        },
      ],
    },
    evidence: [
      {
        id: "source",
        text: "We decided on one screen in the room.",
        startMs: 1000,
        endMs: 2000,
      },
    ],
  }),
}));

test("host can inspect evidence and correct or keep an idea without leaving the board", () => {
  render(<MeetingBoard meetingId="meeting" enabled />);
  fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
  expect(
    screen.getByText("We decided on one screen in the room."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit idea" }), {
    target: { value: "Host controls the room display" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save & keep" }));
  expect(actions.edit).toHaveBeenCalledWith(
    "display",
    "Host controls the room display",
  );
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  expect(actions.hide).toHaveBeenCalledWith("display");
  fireEvent.click(screen.getByRole("button", { name: "Pause updates" }));
  expect(actions.toggle).toHaveBeenCalled();
}, 20_000);
