import { Component, lazy, type ReactNode, Suspense, useState } from "react";

import type { Idea } from "./core";
import { DiscussionRegion } from "./discussion";
import { EvidencePanel } from "./evidence-panel";
import type { useBoard } from "./use-board";

const BoardCanvas = lazy(() => import("./canvas"));

export function MeetingBoardView({
  state,
  enabled,
  storageNotice = "Saved on this Mac",
}: {
  state: Omit<ReturnType<typeof useBoard>, "reshape" | "releaseStructure"> &
    Partial<Pick<ReturnType<typeof useBoard>, "reshape" | "releaseStructure">>;
  enabled: boolean;
  storageNotice?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"discussion" | "cards" | "canvas">(
    "discussion",
  );
  const visible = state.board.ideas.filter((idea) => !idea.hidden);
  const groups = new Map<string, Idea[]>();
  for (const idea of visible) {
    groups.set(idea.topic, [...(groups.get(idea.topic) ?? []), idea]);
  }
  const inspected = visible.find((idea) => idea.id === selected);
  return (
    <section
      aria-label="Meeting whiteboard"
      className="flex h-full min-h-0 flex-col rounded-xl border border-neutral-200 bg-stone-50 text-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-5 py-3">
        <div className="mr-auto">
          <h2 className="font-semibold">Meeting board</h2>
          <p role="status" className="text-xs text-neutral-600">
            {state.updating
              ? "Updating from the conversation…"
              : state.running
                ? state.evidence.length
                  ? "Following the transcript · updates about every 10 seconds"
                  : "Waiting for transcript · start recording to add ideas"
                : "Board updates paused"}
          </p>
        </div>
        <div
          role="group"
          aria-label="Board view"
          className="flex rounded-lg border border-neutral-300 bg-white p-1 text-sm"
        >
          {(["discussion", "cards", "canvas"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              className={`rounded px-3 py-1 capitalize ${view === mode ? "bg-neutral-900 text-white" : "text-neutral-600"}`}
              onClick={() => setView(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          disabled={!state.canUndo || state.busy}
          onClick={state.undo}
        >
          Undo
        </button>
        <button
          type="button"
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          disabled={
            !state.ready || !state.providerReady || state.busy || !enabled
          }
          onClick={state.toggle}
        >
          {state.running ? "Pause updates" : "Start updates"}
        </button>
      </div>
      {!state.providerReady && (
        <p className="px-5 pt-4 text-sm">
          Choose a direct AI provider and model in Settings → AI to start board
          updates.
        </p>
      )}
      {state.error && (
        <p role="alert" className="px-5 pt-4 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {groups.size === 0 ? (
          <div className="mx-auto max-w-lg py-16 text-center">
            <h3 className="text-xl font-medium">Room for the conversation</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Start recording, then start board updates. Ideas, questions,
              decisions and next steps will take shape here. The board can
              regroup as the discussion develops.
            </p>
            <p className="mt-3 text-xs text-neutral-500">
              Board history stays on this Mac. Updates send transcript excerpts
              and the current board to your selected model.
            </p>
          </div>
        ) : view === "discussion" ? (
          <div className="flex min-h-full flex-wrap gap-5">
            <div className="min-w-0 flex-1 basis-[600px]">
              <DiscussionRegion
                board={state.board}
                disabled={state.busy || !state.reshape}
                onChange={(region) => state.reshape?.(region)}
                onRelease={() => state.releaseStructure?.()}
                onSelect={setSelected}
              />
            </div>
            {inspected && (
              <aside
                aria-label="Selected element"
                className="w-80 max-w-full shrink-0"
              >
                <button
                  type="button"
                  className="mb-3 text-sm underline"
                  onClick={() => setSelected(null)}
                >
                  Close detail
                </button>
                <IdeaCard
                  key={inspected.id}
                  idea={inspected}
                  disabled={state.busy}
                  onEdit={state.edit}
                  onHide={state.hide}
                  onRelease={state.release}
                  onInspect={() => setSelected(inspected.id)}
                />
                <EvidencePanel
                  idea={inspected}
                  evidence={state.evidence}
                  onClose={() => setSelected(null)}
                />
              </aside>
            )}
          </div>
        ) : view === "canvas" ? (
          <div className="flex h-full min-h-96 gap-4">
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200">
              <CanvasBoundary>
                <Suspense
                  fallback={
                    <p role="status" className="p-5 text-sm">
                      Opening canvas…
                    </p>
                  }
                >
                  <BoardCanvas board={state.board} onSelect={setSelected} />
                </Suspense>
              </CanvasBoundary>
            </div>
            <div className="w-80 shrink-0 overflow-auto">
              <label className="block text-sm font-medium">
                Choose a board card
                <select
                  aria-label="Choose a board card"
                  className="mt-2 mb-4 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm"
                  value={inspected?.id ?? ""}
                  onChange={(event) => setSelected(event.target.value || null)}
                >
                  <option value="">Select a card…</option>
                  {visible.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.text}
                    </option>
                  ))}
                </select>
              </label>
              {inspected ? (
                <>
                  <IdeaCard
                    key={inspected.id}
                    idea={inspected}
                    disabled={state.busy}
                    onEdit={state.edit}
                    onHide={state.hide}
                    onRelease={state.release}
                    onInspect={() => setSelected(inspected.id)}
                  />
                  <EvidencePanel
                    idea={inspected}
                    evidence={state.evidence}
                    onClose={() => setSelected(null)}
                  />
                </>
              ) : (
                <p className="text-sm leading-relaxed text-neutral-600">
                  Select a card on the canvas or from the list to edit it and
                  inspect its evidence.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...groups].map(([topic, ideas]) => (
              <section key={topic} aria-label={topic}>
                <h3 className="mb-3 border-b border-neutral-300 pb-2 text-base font-semibold">
                  {topic}
                </h3>
                <div className="flex flex-col gap-3">
                  {ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      disabled={state.busy}
                      onEdit={state.edit}
                      onHide={state.hide}
                      onRelease={state.release}
                      onInspect={() => setSelected(idea.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {view === "cards" && inspected && (
          <EvidencePanel
            idea={inspected}
            evidence={state.evidence}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      <div className="border-t border-neutral-200 px-5 py-2 text-xs text-neutral-500">
        Revision {state.board.revision} · {storageNotice}
        {state.busy ? " · Saving…" : ""}
      </div>
    </section>
  );
}

class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="p-5 text-sm">
        Canvas couldn’t open. Switch to Cards to keep working.
      </p>
    ) : (
      this.props.children
    );
  }
}

function IdeaCard({
  idea,
  disabled,
  onEdit,
  onHide,
  onRelease,
  onInspect,
}: {
  idea: Idea;
  disabled: boolean;
  onEdit: (id: string, text: string) => void;
  onHide: (id: string) => void;
  onRelease: (id: string) => void;
  onInspect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(idea.text);
  const colors = {
    idea: "bg-white",
    question: "bg-amber-50",
    decision: "bg-emerald-50",
    action: "bg-sky-50",
  };
  return (
    <article
      className={`rounded-lg border border-neutral-200 p-4 shadow-sm ${colors[idea.kind]}`}
    >
      <div className="mb-2 flex justify-between text-xs font-medium text-neutral-600">
        <span className="capitalize">{idea.kind}</span>
        {idea.edited && <span>Kept by you</span>}
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) {
              onEdit(idea.id, text);
              setEditing(false);
            }
          }}
        >
          <textarea
            autoFocus
            aria-label="Edit idea"
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-24 w-full rounded border border-neutral-400 bg-white p-2 text-sm"
          />
          <div className="mt-2 flex gap-3 text-xs">
            <button
              disabled={disabled || !text.trim()}
              type="submit"
              className="underline"
            >
              Save & keep
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {idea.text}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-600">
        <button type="button" onClick={onInspect} className="underline">
          Evidence
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setText(idea.text);
            setEditing(true);
          }}
          className="underline disabled:opacity-40"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={disabled}
          title={
            idea.edited
              ? "Allow AI to revise this card again"
              : "Protect this card from AI changes"
          }
          onClick={() =>
            idea.edited ? onRelease(idea.id) : onEdit(idea.id, idea.text)
          }
          className="underline disabled:opacity-40"
        >
          {idea.edited ? "Release" : "Keep"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onHide(idea.id)}
          className="ml-auto underline disabled:opacity-40"
        >
          Hide
        </button>
      </div>
    </article>
  );
}
