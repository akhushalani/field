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
  label?: string;
};

export type Discussion = {
  title: string;
  mode: "explore" | "compare" | "decide";
  ideaIds: string[];
  options: string[];
  links: {
    from: string;
    to: string;
    kind: "supports" | "challenges" | "depends on" | "alternative to";
  }[];
  decisionId?: string;
  edited: boolean;
};

export type Board = {
  meetingId: string;
  revision: number;
  ideas: Idea[];
  discussion?: Discussion;
};

export type ModelPatch = {
  meetingId: string;
  baseRevision: number;
  upserts: Omit<Idea, "edited" | "hidden">[];
  removeIds: string[];
  discussion?: Omit<Discussion, "edited">;
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
      (idea.label !== undefined &&
        (!idea.label.trim() || idea.label.length > 70)) ||
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
  const next = {
    ...board,
    revision: board.revision + 1,
    ideas: [...ideas.values()],
  };
  if (patch.discussion && !board.discussion?.edited) {
    validateDiscussion(patch.discussion, next.ideas);
    if (
      board.ideas.some(
        (idea) =>
          idea.edited &&
          !idea.hidden &&
          (!board.discussion || board.discussion.ideaIds.includes(idea.id)) &&
          !patch.discussion!.ideaIds.includes(idea.id),
      )
    ) {
      throw new Error("A protected element must stay in the discussion");
    }
    next.discussion = { ...patch.discussion, edited: false };
  }
  return next;
}

export function editIdea(board: Board, id: string, text: string): Board {
  if (!text.trim() || text.length > 2000) throw new Error("Enter a short idea");
  if (!board.ideas.some((idea) => idea.id === id))
    throw new Error("Idea not found");
  return {
    ...board,
    revision: board.revision + 1,
    ideas: board.ideas.map((idea) =>
      idea.id === id
        ? {
            ...idea,
            text,
            label: text === idea.text ? idea.label : undefined,
            edited: true,
          }
        : idea,
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

export function validateDiscussion(
  region: Omit<Discussion, "edited">,
  ideas: Idea[],
) {
  const ids = new Set(region.ideaIds);
  if (
    !region.title.trim() ||
    region.title.length > 90 ||
    !["explore", "compare", "decide"].includes(region.mode) ||
    !ids.size ||
    ids.size > 12 ||
    ids.size !== region.ideaIds.length ||
    region.ideaIds.some(
      (id) => !ideas.some((idea) => idea.id === id && !idea.hidden),
    ) ||
    region.options.length > 4 ||
    new Set(region.options).size !== region.options.length ||
    region.options.some((id) => !ids.has(id)) ||
    region.links.length > 24 ||
    region.links.some(
      (link) =>
        !ids.has(link.from) ||
        !ids.has(link.to) ||
        link.from === link.to ||
        !["supports", "challenges", "depends on", "alternative to"].includes(
          link.kind,
        ),
    ) ||
    (region.decisionId &&
      !ideas.some(
        (idea) =>
          idea.id === region.decisionId &&
          ids.has(idea.id) &&
          idea.kind === "decision" &&
          !idea.hidden,
      )) ||
    (region.mode === "decide" && !region.decisionId) ||
    (region.mode === "compare" && region.options.length < 2)
  ) {
    throw new Error("Invalid discussion structure");
  }
}

export function editDiscussion(
  board: Board,
  discussion: Omit<Discussion, "edited">,
): Board {
  validateDiscussion(discussion, board.ideas);
  return {
    ...board,
    revision: board.revision + 1,
    discussion: { ...discussion, edited: true },
  };
}
