export type Evidence = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type Idea = {
  id: string;
  text: string;
  kind: "idea" | "question" | "decision" | "action";
  topic: string;
  sourceIds: string[];
  edited: boolean;
  hidden: boolean;
};

export type Board = {
  meetingId: string;
  revision: number;
  ideas: Idea[];
};

export type ModelPatch = {
  meetingId: string;
  baseRevision: number;
  upserts: Omit<Idea, "edited" | "hidden">[];
  removeIds: string[];
};

export function applyModelPatch(
  board: Board,
  patch: ModelPatch,
  evidence: ReadonlyMap<string, Evidence>,
): Board {
  if (
    patch.meetingId !== board.meetingId ||
    patch.baseRevision !== board.revision
  ) {
    throw new Error("Board changed while this update was being prepared");
  }
  if (patch.upserts.length > 100 || patch.removeIds.length > 100) {
    throw new Error("Board update is too large");
  }
  const ids = new Set<string>();
  for (const idea of patch.upserts) {
    if (!idea.id || ids.has(idea.id) || patch.removeIds.includes(idea.id)) {
      throw new Error("Conflicting idea identifiers");
    }
    ids.add(idea.id);
    if (
      !idea.text.trim() ||
      idea.text.length > 2000 ||
      !idea.topic.trim() ||
      idea.topic.length > 100 ||
      !["idea", "question", "decision", "action"].includes(idea.kind) ||
      !idea.sourceIds.length ||
      idea.sourceIds.length > 20 ||
      idea.sourceIds.some((id) => !evidence.has(id))
    ) {
      throw new Error("Every idea needs valid meeting evidence");
    }
  }
  const ideas = new Map(board.ideas.map((idea) => [idea.id, { ...idea }]));
  for (const id of patch.removeIds) {
    const idea = ideas.get(id);
    if (idea && !idea.edited) ideas.set(id, { ...idea, hidden: true });
  }
  for (const update of patch.upserts) {
    const previous = ideas.get(update.id);
    if (previous?.edited) continue;
    ideas.set(update.id, {
      ...update,
      sourceIds: [...update.sourceIds],
      edited: false,
      hidden: false,
    });
  }
  return { ...board, revision: board.revision + 1, ideas: [...ideas.values()] };
}

export function editIdea(board: Board, id: string, text: string): Board {
  if (!text.trim() || text.length > 2000) throw new Error("Enter a short idea");
  if (!board.ideas.some((idea) => idea.id === id))
    throw new Error("Idea not found");
  return {
    ...board,
    revision: board.revision + 1,
    ideas: board.ideas.map((idea) =>
      idea.id === id ? { ...idea, text, edited: true } : idea,
    ),
  };
}

export function hideIdea(board: Board, id: string): Board {
  if (!board.ideas.some((idea) => idea.id === id))
    throw new Error("Idea not found");
  return {
    ...board,
    revision: board.revision + 1,
    ideas: board.ideas.map((idea) =>
      idea.id === id ? { ...idea, hidden: true, edited: true } : idea,
    ),
  };
}

export function releaseIdea(board: Board, id: string): Board {
  if (!board.ideas.some((idea) => idea.id === id))
    throw new Error("Idea not found");
  return {
    ...board,
    revision: board.revision + 1,
    ideas: board.ideas.map((idea) =>
      idea.id === id ? { ...idea, edited: false } : idea,
    ),
  };
}
