import type { Evidence, Idea } from "./core";

export function EvidencePanel({
  idea,
  evidence,
  onClose,
}: {
  idea: Idea;
  evidence: Evidence[];
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Transcript evidence"
      className="mt-6 rounded-xl border border-neutral-300 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">From the conversation</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm underline"
        >
          Close evidence
        </button>
      </div>
      <p className="mt-2 text-sm font-medium">{idea.text}</p>
      {idea.sourceIds.map((id) => {
        const source = evidence.find((item) => item.id === id);
        return (
          <blockquote
            key={id}
            className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm leading-relaxed"
          >
            {source ? (
              <>
                <time className="mr-2 text-xs text-neutral-500">
                  {new Date(source.startMs).toLocaleTimeString()}
                </time>
                {source.text}
              </>
            ) : (
              "This excerpt is no longer available in the transcript."
            )}
          </blockquote>
        );
      })}
    </aside>
  );
}
