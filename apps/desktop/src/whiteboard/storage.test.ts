import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import migrationSql from "../../../../crates/db-app/migrations/20261109090000_local_meeting_boards.sql?raw";
import { persistBoard, readBoardHistory } from "./storage";

let sqlite: DatabaseSync;
vi.mock("~/db", () => ({
  liveQueryClient: {
    execute: async (sql: string, params: never[]) =>
      sqlite.prepare(sql).all(...params),
  },
  executeTransaction: async (
    statements: {
      sql: string;
      params: never[];
      expectedRowsAffected: number;
    }[],
  ) => {
    sqlite.exec("BEGIN");
    try {
      for (const statement of statements) {
        const result = sqlite.prepare(statement.sql).run(...statement.params);
        if (Number(result.changes) !== statement.expectedRowsAffected)
          throw new Error("Conflict");
      }
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
}));

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE sessions (id TEXT PRIMARY KEY, deleted_at INTEGER); INSERT INTO sessions VALUES ('meeting', NULL), ('other', NULL)",
  );
  sqlite.exec(migrationSql);
});
afterEach(() => sqlite.close());

test("board history survives reload, rejects concurrent revisions, and follows session deletion", async () => {
  const first = { meetingId: "meeting", revision: 1, ideas: [] };
  await persistBoard(first, 0);
  await persistBoard({ ...first, revision: 2 }, 1);
  await expect(persistBoard({ ...first, revision: 3 }, 1)).rejects.toThrow(
    "Conflict",
  );
  expect(
    (await readBoardHistory("meeting")).map((board) => board.revision),
  ).toEqual([1, 2]);
  expect(await readBoardHistory("other")).toEqual([]);
  sqlite.exec("UPDATE sessions SET deleted_at = 1 WHERE id = 'meeting'");
  expect(await readBoardHistory("meeting")).toEqual([]);
  await expect(persistBoard({ ...first, revision: 3 }, 2)).rejects.toThrow();
  sqlite.exec("DELETE FROM sessions WHERE id = 'meeting'");
  expect(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM local_meeting_board_revisions")
      .get()?.count,
  ).toBe(0);
});
