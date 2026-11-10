import { renderHook } from "@testing-library/react";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import { useLiveQuery } from "~/db";

vi.mock("~/db", () => ({ useLiveQuery: vi.fn(() => ({ data: undefined })) }));

import { sharedNoteEventKey } from "./event-key";
import {
  parseSharedNoteEventKeys,
  sharedNoteIdsForEventKey,
  useLocalSessionEventKeys,
} from "./event-keys";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

describe("shared note event keys", () => {
  it("executes calendar matching in SQLite and prefers the session's explicit event", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE sessions (id TEXT, event_id TEXT, event_json TEXT, deleted_at TEXT);
        CREATE TABLE events (id TEXT, tracking_id_event TEXT, calendar_id TEXT, started_at TEXT, deleted_at TEXT);
        INSERT INTO sessions VALUES ('session', 'explicit', '{"tracking_id":"ical-uid","calendar_id":"calendar"}', NULL);
        INSERT INTO events VALUES
          ('fallback', 'ical-uid', 'calendar', '2026-10-08T10:00:00Z', NULL),
          ('explicit', 'explicit-uid', 'calendar', '2026-10-08T15:00:00Z', NULL);
      `);
      renderHook(() => useLocalSessionEventKeys());
      const calls = vi.mocked(useLiveQuery).mock.calls;
      const query = calls[calls.length - 1][0];
      expect(db.prepare(query.sql).all()).toEqual([
        {
          tracking_id_event: "explicit-uid",
          started_at: "2026-10-08T15:00:00Z",
        },
      ]);
    } finally {
      db.close();
    }
  });
  it("matches a recipient's calendar event regardless of timestamp format", () => {
    const shared = sharedNoteEventKey("ical-uid", "2026-10-08T15:00:00Z");
    const local = sharedNoteEventKey("ical-uid", "2026-10-08T17:00:00+02:00");
    expect(local).toBe(shared);
    expect(sharedNoteEventKey("", "2026-10-08T15:00:00Z")).toBe("");
    expect(sharedNoteEventKey("ical-uid", "not a date")).toBe("");
  });

  it("only exposes keys stored for the signed-in viewer", () => {
    const valueJson = JSON.stringify({
      viewer_user_id: "viewer",
      keys: { share: "ical-uid|2026-10-08T15:00:00.000Z" },
    });
    const keys = parseSharedNoteEventKeys(valueJson, "viewer");
    expect(keys.get("share")).toBe("ical-uid|2026-10-08T15:00:00.000Z");
    expect(parseSharedNoteEventKeys(valueJson, "other").size).toBe(0);
    expect(parseSharedNoteEventKeys("{", "viewer").size).toBe(0);
  });

  it("merges only received shares for the same event into a note", () => {
    const key = "ical-uid|2026-10-08T15:00:00.000Z";
    const keys = new Map([
      ["received", key],
      ["owned", key],
      ["other-event", "ical-uid|2026-10-15T15:00:00.000Z"],
    ]);
    const notes = [
      { shareId: "received", manageAccess: false },
      { shareId: "owned", manageAccess: true },
      { shareId: "other-event", manageAccess: false },
    ];
    expect(sharedNoteIdsForEventKey(key, keys, notes)).toEqual(["received"]);
    expect(sharedNoteIdsForEventKey("", keys, notes)).toEqual([]);
  });
});
