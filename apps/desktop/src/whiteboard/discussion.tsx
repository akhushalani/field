import "./discussion.css";

import { useState } from "react";

import type { Board, Discussion, Idea } from "./core";

export function DiscussionRegion({
  board,
  disabled,
  onChange,
  onRelease,
  onSelect,
}: {
  board: Board;
  disabled: boolean;
  onChange: (region: Omit<Discussion, "edited">) => void;
  onRelease: () => void;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const visible = board.ideas.filter((i) => !i.hidden);
  const stored: Discussion = board.discussion ?? {
    title: visible[0]?.topic ?? "What are we exploring?",
    mode: "explore",
    ideaIds: visible.slice(0, 12).map((i) => i.id),
    options: [],
    links: [],
    edited: false,
  };
  const available = new Set(visible.map((i) => i.id));
  const region: Discussion = {
    ...stored,
    ideaIds: stored.ideaIds.filter((id) => available.has(id)),
    options: stored.options.filter((id) => available.has(id)),
    links: stored.links.filter(
      (l) => available.has(l.from) && available.has(l.to),
    ),
    mode:
      (stored.mode === "decide" && !available.has(stored.decisionId ?? "")) ||
      (stored.mode === "compare" &&
        stored.options.filter((id) => available.has(id)).length < 2)
        ? "explore"
        : stored.mode,
  };
  const ideas = region.ideaIds.flatMap((id) =>
    visible.filter((i) => i.id === id),
  );
  const label = (idea: Idea) =>
    idea.label ??
    (idea.text.length > 70 ? `${idea.text.slice(0, 67)}…` : idea.text);
  const find = (id: string) => ideas.find((i) => i.id === id);
  const options = region.options.flatMap((id) => find(id) ?? []);
  const decision = region.decisionId ? find(region.decisionId) : undefined;
  const change = (next: Omit<Discussion, "edited">) => {
    try {
      onChange(next);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t change this discussion",
      );
    }
  };
  const node = (idea: Idea, prominent = false) => (
    <button
      type="button"
      key={idea.id}
      onClick={() => onSelect(idea.id)}
      className={`discussion-node ${prominent ? "discussion-prominent" : ""} ${idea.kind === "question" ? "discussion-question" : ""}`}
    >
      {label(idea)}
      {idea.edited && (
        <span aria-label="Kept by you" className="discussion-kept" />
      )}
    </button>
  );
  const mode = (next: Discussion["mode"]) => {
    const selectedDecision =
      decision ?? ideas.find((i) => i.kind === "decision");
    change({
      ...region,
      mode: next,
      decisionId: next === "decide" ? selectedDecision?.id : region.decisionId,
    });
  };
  // The bounded projection keeps the same semantic IDs across all three forms.
  const branches = options.length
    ? options
    : ideas
        .filter((i) => !region.links.some((l) => l.from === i.id))
        .slice(0, 4);
  const roots = branches.length ? branches : ideas.slice(0, 4);
  const remaining = ideas.filter(
    (i) => !roots.some((root) => root.id === i.id),
  );
  const positions = new Map<string, { x: number; y: number }>();
  roots.forEach((idea, i) =>
    positions.set(idea.id, { x: ((i + 0.5) * 1000) / roots.length, y: 140 }),
  );
  remaining.forEach((idea, i) =>
    positions.set(idea.id, {
      x: ((i % 4) + 0.5) * 250,
      y: 270 + Math.floor(i / 4) * 110,
    }),
  );
  return (
    <section className="discussion-region" aria-label="Discussion region">
      <header className="discussion-header">
        {region.mode !== "explore" && <h3>{region.title}</h3>}
        <div className="discussion-tools">
          <div aria-label="Discussion form" className="discussion-modes">
            {(
              [
                ["explore", "Explore"],
                ["compare", "Compare"],
                ["decide", "Decision"],
              ] as const
            ).map(([value, title]) => (
              <button
                key={value}
                type="button"
                disabled={
                  disabled ||
                  (value === "compare" && options.length < 2) ||
                  (value === "decide" &&
                    !ideas.some((i) => i.kind === "decision"))
                }
                aria-pressed={region.mode === value}
                onClick={() => mode(value)}
              >
                {title}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Structure"}
          </button>
          {region.edited && (
            <button type="button" disabled={disabled} onClick={onRelease}>
              Release structure
            </button>
          )}
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {editing && (
        <form
          className="discussion-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const from = String(data.get("from"));
            const to = String(data.get("to"));
            const kind = String(
              data.get("kind"),
            ) as Discussion["links"][number]["kind"];
            change({
              ...region,
              links: [
                ...region.links.filter(
                  (l) => !(l.from === from && l.to === to),
                ),
                { from, to, kind },
              ],
            });
          }}
        >
          <label>
            Question
            <input
              aria-label="Discussion question"
              maxLength={90}
              defaultValue={region.title}
              key={region.title}
              onBlur={(e) => {
                if (e.target.value !== region.title)
                  change({ ...region, title: e.target.value });
              }}
            />
          </label>
          <fieldset>
            <legend>Alternatives</legend>
            {ideas.map((idea) => (
              <label key={idea.id}>
                <input
                  type="checkbox"
                  checked={region.options.includes(idea.id)}
                  disabled={disabled}
                  onChange={(e) =>
                    change({
                      ...region,
                      options: e.target.checked
                        ? [...region.options, idea.id]
                        : region.options.filter((id) => id !== idea.id),
                      mode: "explore",
                    })
                  }
                />
                {label(idea)}
              </label>
            ))}
          </fieldset>
          <div className="discussion-link-editor">
            <select name="from" aria-label="Relationship source">
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  {label(i)}
                </option>
              ))}
            </select>
            <select name="kind" aria-label="Relationship meaning">
              {["supports", "challenges", "depends on", "alternative to"].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </select>
            <select name="to" aria-label="Relationship target">
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  {label(i)}
                </option>
              ))}
            </select>
            <button disabled={disabled} type="submit">
              Connect
            </button>
          </div>
          {region.links.map((link, i) => (
            <button
              type="button"
              disabled={disabled}
              key={i}
              onClick={() =>
                change({
                  ...region,
                  links: region.links.filter((_, j) => j !== i),
                })
              }
              aria-label={`Remove relationship ${label(find(link.from) ?? ({ text: link.from } as Idea))} ${link.kind} ${label(find(link.to) ?? ({ text: link.to } as Idea))}`}
            >
              {find(link.from) ? label(find(link.from)!) : link.from} →{" "}
              {link.kind} → {find(link.to) ? label(find(link.to)!) : link.to} ×
            </button>
          ))}
        </form>
      )}
      {region.mode === "explore" && (
        <div className="discussion-map">
          <svg
            viewBox={`0 0 1000 ${remaining.length > 4 ? 490 : 360}`}
            role="group"
            aria-label="Exploration map"
          >
            <defs>
              <marker
                id="discussion-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8" fill="none" stroke="currentColor" />
              </marker>
            </defs>
            {roots.map((idea) => {
              const p = positions.get(idea.id)!;
              return (
                <path
                  key={idea.id}
                  d={`M500 45 Q500 110 ${p.x} ${p.y - 34}`}
                  fill="none"
                  stroke="#b5b2aa"
                />
              );
            })}
            {region.links.map((link, i) => {
              const a = positions.get(link.from),
                b = positions.get(link.to);
              if (!a || !b) return null;
              return (
                <g
                  key={i}
                  className={`discussion-edge edge-${link.kind.split(" ")[0]}`}
                >
                  <path
                    d={`M${a.x} ${a.y - 32} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2} ${b.x} ${b.y + 34}`}
                    fill="none"
                    markerEnd="url(#discussion-arrow)"
                  />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 6}
                    textAnchor="middle"
                  >
                    {link.kind}
                  </text>
                </g>
              );
            })}
            <foreignObject x="340" y="0" width="320" height="70">
              <div className="discussion-root">{region.title}</div>
            </foreignObject>
            {ideas.map((idea) => {
              const p = positions.get(idea.id);
              return (
                p && (
                  <foreignObject
                    key={idea.id}
                    x={p.x - 108}
                    y={p.y - 34}
                    width="216"
                    height="86"
                  >
                    {node(
                      idea,
                      roots.some((r) => r.id === idea.id),
                    )}
                  </foreignObject>
                )
              );
            })}
          </svg>
        </div>
      )}
      {region.mode === "compare" && (
        <div
          className="discussion-comparison"
          style={{
            gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(200px,1fr))`,
          }}
        >
          {options.map((option) => (
            <section key={option.id} aria-label={label(option)}>
              {node(option, true)}
              {(["supports", "challenges", "depends on"] as const).map(
                (kind) => (
                  <div
                    className={`discussion-tradeoff tradeoff-${kind.split(" ")[0]}`}
                    key={kind}
                  >
                    <h4>
                      {kind === "supports"
                        ? "For"
                        : kind === "challenges"
                          ? "Against"
                          : "Needs"}
                    </h4>
                    {region.links
                      .filter(
                        (l) =>
                          l.to === option.id && l.kind === kind && find(l.from),
                      )
                      .map((l) => node(find(l.from)!))}
                    {!region.links.some(
                      (l) =>
                        l.to === option.id && l.kind === kind && find(l.from),
                    ) && (
                      <span
                        className="discussion-blank"
                        aria-label="Not discussed"
                      >
                        —
                      </span>
                    )}
                  </div>
                ),
              )}
            </section>
          ))}
        </div>
      )}
      {region.mode === "decide" && (
        <div className="discussion-decision">
          {decision ? (
            <>
              <div className="discussion-choice">
                <span>Decision</span>
                {node(decision, true)}
              </div>
              <div className="discussion-reasons">
                {region.links
                  .filter((l) => l.to === decision.id && find(l.from))
                  .map((l) => (
                    <div key={`${l.from}-${l.kind}`}>
                      <span>{l.kind}</span>
                      {node(find(l.from)!)}
                    </div>
                  ))}
              </div>
              <div className="discussion-open">
                {ideas
                  .filter((i) => i.kind === "question" || i.kind === "action")
                  .map((i) => node(i))}
              </div>
            </>
          ) : (
            <p>No explicit decision yet.</p>
          )}
        </div>
      )}
      {region.mode !== "explore" && (
        <details className="discussion-background">
          <summary>Explore all {ideas.length} elements</summary>
          <div>{ideas.map((i) => node(i))}</div>
        </details>
      )}
    </section>
  );
}
