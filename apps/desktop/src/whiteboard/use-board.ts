import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyModelPatch,
  type Board,
  editIdea,
  hideIdea,
  releaseIdea,
} from "./core";
import { transcriptEvidence } from "./evidence";
import { proposeBoardUpdate } from "./model";
import { persistBoard, readBoardHistory } from "./storage";

import {
  useLanguageModel,
  useLLMConnection,
} from "~/ai/hooks/useLLMConnection";
import { useSessionTranscripts } from "~/stt/queries";

export function useBoard(meetingId: string, enabled: boolean) {
  const model = useLanguageModel();
  const { status: connection } = useLLMConnection();
  const transcripts = useSessionTranscripts(meetingId);
  const evidence = useMemo(
    () => transcriptEvidence(transcripts),
    [transcripts],
  );
  const [history, setHistory] = useState<Board[]>([]);
  const [undoBoard, setUndoBoard] = useState<Board | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const empty = useMemo<Board>(
    () => ({ meetingId, revision: 0, ideas: [] }),
    [meetingId],
  );
  const board = history[history.length - 1] ?? empty;
  const current = useRef(board);
  current.current = board;
  const writing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const latest = useRef({ evidence, model });
  latest.current = { evidence, model };
  const processed = useRef("");
  const reorganizedAt = useRef(0);
  const providerReady =
    connection.status === "success" && !connection.isHosted && !!model;

  useEffect(() => {
    let disposed = false;
    void readBoardHistory(meetingId)
      .then((loaded) => {
        if (!disposed) {
          setHistory(loaded);
          setUndoBoard(loaded[loaded.length - 2] ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!disposed)
          setError(
            "Couldn’t load this board. Reopen the meeting to try again.",
          );
      });
    return () => {
      disposed = true;
      request.current?.abort();
    };
  }, [meetingId]);

  async function commit(next: Board, isUndo = false) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      await persistBoard(next, current.current.revision);
      setUndoBoard(isUndo ? null : current.current);
      current.current = next;
      setHistory((previous) => [...previous, next].slice(-100));
      setError(null);
    } catch {
      setRunning(false);
      setError(
        "Couldn’t save the update. Your saved board is unchanged. Reopen the meeting before continuing.",
      );
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!running || !enabled || !ready || !providerReady) {
      request.current?.abort();
      return;
    }
    let disposed = false;
    async function tick() {
      const { evidence: sources, model: selectedModel } = latest.current;
      const fingerprint = JSON.stringify(sources);
      if (
        disposed ||
        request.current ||
        writing.current ||
        !selectedModel ||
        !sources.length ||
        fingerprint === processed.current
      )
        return;
      const abort = new AbortController();
      request.current = abort;
      setUpdating(true);
      const base = current.current;
      const reorganize = Date.now() - reorganizedAt.current >= 45_000;
      try {
        const patch = await proposeBoardUpdate(
          selectedModel,
          base,
          sources,
          reorganize,
          abort.signal,
        );
        if (disposed || abort.signal.aborted || writing.current) return;
        const now = new Map(
          latest.current.evidence.map((item) => [item.id, item]),
        );
        // Corrections/replacements invalidate affected results, but new speech needn't.
        const before = new Map(sources.map((item) => [item.id, item.text]));
        if (
          patch.upserts.some((idea) =>
            idea.sourceIds.some((id) => now.get(id)?.text !== before.get(id)),
          )
        )
          return;
        const next = applyModelPatch(current.current, patch, now);
        await commit(next);
        processed.current = fingerprint;
        if (reorganize) reorganizedAt.current = Date.now();
      } catch {
        if (!disposed && !abort.signal.aborted) {
          setRunning(false);
          setError(
            "The model couldn’t update the board. Check your provider, then resume to try again.",
          );
        }
      } finally {
        if (request.current === abort) request.current = null;
        if (!disposed) setUpdating(false);
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 10_000);
    return () => {
      disposed = true;
      clearInterval(timer);
      request.current?.abort();
      request.current = null;
      setUpdating(false);
    };
  }, [running, enabled, ready, providerReady, model]);

  function change(next: Board, isUndo = false) {
    request.current?.abort();
    void commit(next, isUndo);
  }

  return {
    board,
    evidence,
    ready,
    busy,
    error,
    updating,
    running: running && enabled && providerReady,
    providerReady,
    toggle: () => {
      setError(null);
      setRunning((value) => !value);
    },
    edit: (id: string, text: string) =>
      change(editIdea(current.current, id, text)),
    hide: (id: string) => change(hideIdea(current.current, id)),
    release: (id: string) => change(releaseIdea(current.current, id)),
    canUndo: undoBoard !== null,
    undo: () => {
      const previous = undoBoard;
      if (previous)
        change({ ...previous, revision: current.current.revision + 1 }, true);
    },
  };
}
