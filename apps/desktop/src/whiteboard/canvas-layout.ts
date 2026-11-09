import type { ElkNode } from "elkjs/lib/elk-api";

import type { Board } from "./core";

type Dimensions = { width: number; height: number };
type LayoutEngine = { layout: (graph: ElkNode) => Promise<ElkNode> };

export async function layoutBoard(
  board: Board,
  sizes: ReadonlyMap<string, Dimensions>,
  engine: LayoutEngine,
  headers: ReadonlyMap<string, number> = new Map(),
) {
  const topics = new Map<string, string[]>();
  for (const idea of board.ideas.filter((idea) => !idea.hidden)) {
    topics.set(idea.topic, [...(topics.get(idea.topic) ?? []), idea.id]);
  }
  const graph = await engine.layout({
    id: "board",
    layoutOptions: {
      "elk.algorithm": "box",
      "elk.aspectRatio": "1.6",
      "elk.spacing.nodeNode": "48",
      "elk.padding": "[top=24,left=24,bottom=24,right=24]",
    },
    children: [...topics].map(([topic, ids]) => ({
      id: `topic:${topic}`,
      labels: [{ text: topic }],
      layoutOptions: {
        "elk.algorithm": "box",
        "elk.aspectRatio": "0.1",
        "elk.spacing.nodeNode": "20",
        "elk.padding": `[top=${Math.max(60, (headers.get(topic) ?? 28) + 32)},left=20,bottom=20,right=20]`,
      },
      children: ids.map((id) => ({
        id: `card:${id}`,
        ...(sizes.get(id) ?? { width: 320, height: 140 }),
      })),
    })),
  });
  return {
    groups: (graph.children ?? []).map((group) => ({
      id: group.id,
      title: group.labels?.[0]?.text ?? "",
      x: group.x ?? 0,
      y: group.y ?? 0,
      width: group.width ?? 0,
      height: group.height ?? 0,
    })),
    cards: (graph.children ?? []).flatMap((group) =>
      (group.children ?? []).map((card) => ({
        id: card.id.slice("card:".length),
        topic: group.labels?.[0]?.text ?? "",
        x: (group.x ?? 0) + (card.x ?? 0),
        y: (group.y ?? 0) + (card.y ?? 0),
      })),
    ),
  };
}
