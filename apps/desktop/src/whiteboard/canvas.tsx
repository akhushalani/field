import "./canvas-assets";
import "@excalidraw/excalidraw/index.css";
import "./canvas.css";

import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  Excalidraw,
  FONT_FAMILY,
  MainMenu,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import ELK from "elkjs/lib/elk-api";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import { useEffect, useRef, useState } from "react";

import { layoutBoard } from "./canvas-layout";
import type { Board } from "./core";

const colors = {
  idea: "#ffffff",
  question: "#fffbeb",
  decision: "#ecfdf5",
  action: "#f0f9ff",
};

export default function BoardCanvas({
  board,
  onSelect,
}: {
  board: Board;
  onSelect: (id: string) => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [error, setError] = useState(false);
  const firstLayout = useRef(true);

  useEffect(() => {
    if (!api) return;
    let disposed = false;
    const worker = new ElkWorker();
    const engine = new ELK({ workerFactory: () => worker });
    setError(false);
    async function update() {
      const visible = board.ideas.filter((idea) => !idea.hidden);
      const skeletons: ExcalidrawElementSkeleton[] = visible.map((idea) => ({
        id: `card:${idea.id}`,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 320,
        height: 140,
        backgroundColor: colors[idea.kind],
        strokeColor: idea.edited ? "#525252" : "#d4d4d4",
        fillStyle: "solid",
        roughness: 0,
        strokeWidth: 1,
        roundness: { type: 3 },
        customData: { ideaId: idea.id },
        label: {
          text: `${idea.kind.toUpperCase()}${idea.edited ? " · KEPT" : ""}\n${idea.text}`,
          fontSize: 20,
          fontFamily: FONT_FAMILY.Helvetica,
          strokeColor: "#262626",
          textAlign: "left",
        },
      }));
      const elements = convertToExcalidrawElements(skeletons, {
        regenerateIds: false,
      });
      const topics = [...new Set(visible.map((idea) => idea.topic))];
      const titles = convertToExcalidrawElements(
        topics.map((topic) => ({
          id: `topic-title:${topic}`,
          type: "text",
          text: topic,
          x: 0,
          y: 0,
          width: 320,
          autoResize: false,
          fontSize: 22,
          fontFamily: FONT_FAMILY.Helvetica,
          strokeColor: "#262626",
          customData: { topic },
        })),
        { regenerateIds: false },
      );
      const sizes = new Map(
        visible.map((idea) => {
          const rect = elements.find(
            (element) => element.id === `card:${idea.id}`,
          )!;
          return [idea.id, { width: rect.width, height: rect.height }];
        }),
      );
      const headers = new Map(
        topics.map((topic) => [
          topic,
          titles.find((title) => title.id === `topic-title:${topic}`)!.height,
        ]),
      );
      const layout = await layoutBoard(board, sizes, engine, headers);
      if (disposed) return;
      const positions = new Map(
        layout.cards.map((card) => [`card:${card.id}`, card]),
      );
      const frames = convertToExcalidrawElements(
        layout.groups.map((group) => ({
          id: group.id,
          type: "rectangle",
          x: group.x,
          y: group.y,
          width: group.width,
          height: group.height,
          strokeColor: "#d4d4d4",
          backgroundColor: "#f5f5f4",
          fillStyle: "solid",
          roughness: 0,
          strokeWidth: 1,
          roundness: { type: 3 },
        })),
        { regenerateIds: false },
      );
      const scene = [
        ...frames,
        ...titles.map((title) => {
          const group = layout.groups.find(
            (group) => group.title === title.customData?.topic,
          )!;
          return { ...title, x: group.x + 20, y: group.y + 16 };
        }),
        ...elements.map((element) => {
          const containerId =
            element.type === "text" ? element.containerId : element.id;
          const position = containerId ? positions.get(containerId) : undefined;
          return position
            ? {
                ...element,
                x: element.x + position.x,
                y: element.y + position.y,
              }
            : element;
        }),
      ].map((element) => ({ ...element, version: board.revision + 1 }));
      api!.updateScene({
        elements: scene,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      if (firstLayout.current && scene.length) {
        api!.scrollToContent(scene, {
          fitToViewport: true,
          viewportZoomFactor: 0.9,
        });
        firstLayout.current = false;
      }
    }
    void update()
      .catch(() => {
        if (!disposed) setError(true);
      })
      .finally(() => worker.terminate());
    return () => {
      disposed = true;
      worker.terminate();
    };
  }, [api, board]);

  return (
    <div
      className="meetingboard-canvas relative h-full min-h-80"
      aria-label="Board canvas"
      onPointerDownCapture={(event) => {
        if (
          !api ||
          event.button !== 0 ||
          !(event.target instanceof HTMLCanvasElement)
        )
          return;
        const point = viewportCoordsToSceneCoords(
          { clientX: event.clientX, clientY: event.clientY },
          api.getAppState(),
        );
        const card = [...api.getSceneElements()]
          .reverse()
          .find(
            (element) =>
              element.type === "rectangle" &&
              typeof element.customData?.ideaId === "string" &&
              point.x >= element.x &&
              point.x <= element.x + element.width &&
              point.y >= element.y &&
              point.y <= element.y + element.height,
          );
        const id = card?.customData?.ideaId;
        if (typeof id === "string") onSelect(id);
      }}
    >
      <button
        type="button"
        className="absolute top-3 right-3 z-10 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm"
        onClick={() =>
          api?.scrollToContent(undefined, {
            fitToViewport: true,
            viewportZoomFactor: 0.9,
          })
        }
      >
        Fit board
      </button>
      {error && (
        <p
          role="alert"
          className="absolute top-14 right-3 left-3 z-10 rounded bg-white p-3 text-sm text-red-800"
        >
          Couldn’t lay out the canvas. Your saved board is intact; use Cards to
          continue.
        </p>
      )}
      <Excalidraw
        excalidrawAPI={setApi}
        viewModeEnabled
        zenModeEnabled
        theme="light"
        name="Field meeting board"
        initialData={{ appState: { viewBackgroundColor: "#fafaf9" } }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            clearCanvas: false,
            changeViewBackgroundColor: false,
            toggleTheme: false,
          },
        }}
      >
        <MainMenu />
      </Excalidraw>
    </div>
  );
}
