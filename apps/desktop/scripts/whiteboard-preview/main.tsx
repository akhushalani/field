import "./style.css";

import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  applyModelPatch,
  type Board,
  editIdea,
  hideIdea,
  releaseIdea,
} from "../../src/whiteboard/core";
import { MeetingBoardView } from "../../src/whiteboard/view";

const evidence = [
  {
    id: "room",
    text: "One screen in the room is enough. The host should control it from their Mac.",
    startMs: 1794254400000,
    endMs: 1794254405000,
  },
  {
    id: "privacy",
    text: "Keep the meeting data on the Mac. Cloud models are fine for quality.",
    startMs: 1794254410000,
    endMs: 1794254415000,
  },
  {
    id: "flow",
    text: "We need the board to keep up without anyone stopping to take notes. Can it regroup as ideas develop?",
    startMs: 1794254420000,
    endMs: 1794254425000,
  },
  {
    id: "pilot",
    text: "Let’s try it in our next meeting and see whether it helps us pick up all the loose ends.",
    startMs: 1794254430000,
    endMs: 1794254435000,
  },
];
const initial: Board = {
  meetingId: "replay",
  revision: 1,
  ideas: [
    {
      id: "display",
      text: "One shared screen, controlled by the host Mac",
      topic: "The meeting room",
      kind: "decision",
      sourceIds: ["room"],
      edited: false,
      hidden: false,
    },
    {
      id: "storage",
      text: "Keep meeting data on the Mac; use cloud models for quality",
      topic: "Privacy & quality",
      kind: "decision",
      sourceIds: ["privacy"],
      edited: false,
      hidden: false,
    },
    {
      id: "flow",
      text: "Let ideas appear without interrupting the conversation",
      topic: "Keep the flow",
      kind: "idea",
      sourceIds: ["flow"],
      edited: false,
      hidden: false,
    },
    {
      id: "structure",
      text: "How often should the board rethink its structure?",
      topic: "Keep the flow",
      kind: "question",
      sourceIds: ["flow"],
      edited: false,
      hidden: false,
    },
    {
      id: "pilot",
      text: "Try the board in the next Thrad meeting",
      topic: "Next steps",
      kind: "action",
      sourceIds: ["pilot"],
      edited: false,
      hidden: false,
    },
  ],
};

function Preview() {
  const [board, setBoard] = useState(initial);
  const [previous, setPrevious] = useState<Board | null>(null);
  function change(next: Board) {
    setPrevious(board);
    setBoard(next);
  }
  return (
    <main className="flex h-screen flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <strong>Field · replay preview</strong>
        <span className="mr-auto text-neutral-600">
          Sample transcript · no recording or model calls · changes last until
          refresh
        </span>
        <button
          className="rounded border border-neutral-400 bg-white px-3 py-2"
          onClick={() =>
            change(
              applyModelPatch(
                board,
                {
                  meetingId: "replay",
                  baseRevision: board.revision,
                  removeIds: [],
                  upserts: board.ideas
                    .filter((idea) =>
                      ["display", "flow", "structure"].includes(idea.id),
                    )
                    .map(({ edited: _edited, hidden: _hidden, ...idea }) => ({
                      ...idea,
                      topic: "A board that follows the room",
                    })),
                },
                new Map(evidence.map((item) => [item.id, item])),
              ),
            )
          }
        >
          Replay regrouping
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <MeetingBoardView
          storageNotice="Replay only · refresh resets changes"
          enabled={false}
          state={{
            board,
            evidence,
            ready: true,
            busy: false,
            error: null,
            updating: false,
            running: false,
            providerReady: true,
            toggle: () => {},
            edit: (id, text) => change(editIdea(board, id, text)),
            hide: (id) => change(hideIdea(board, id)),
            release: (id) => change(releaseIdea(board, id)),
            canUndo: !!previous,
            undo: () => {
              if (previous) {
                setBoard({ ...previous, revision: board.revision + 1 });
                setPrevious(null);
              }
            },
          }}
        />
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
