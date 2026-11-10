import { z } from "zod";

import type { Board } from "./core";
import { discussionSchema } from "./discussion-schema";

import { executeTransaction, liveQueryClient } from "~/db";

const boardSchema = z.object({
  meetingId: z.string(),
  revision: z.number().int().nonnegative(),
  discussion: discussionSchema.extend({ edited: z.boolean() }).optional(),
  ideas: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      label: z.string().optional(),
      topic: z.string(),
      kind: z.enum(["idea", "question", "decision", "action"]),
      sourceIds: z.array(z.string()),
      edited: z.boolean(),
      hidden: z.boolean(),
    }),
  ),
});

export async function readBoardHistory(meetingId: string): Promise<Board[]> {
  const rows = await liveQueryClient.execute<{ board_json: string }>(
    `
    SELECT board.board_json FROM local_meeting_board_revisions AS board
    JOIN sessions AS session ON session.id = board.session_id
    WHERE board.session_id = ? AND session.deleted_at IS NULL
    ORDER BY board.revision DESC LIMIT 100
  `,
    [meetingId],
  );
  return rows.reverse().map((row) => {
    const board = boardSchema.parse(JSON.parse(row.board_json));
    if (board.meetingId !== meetingId)
      throw new Error("Board belongs to another meeting");
    return board;
  });
}

export async function persistBoard(
  board: Board,
  previousRevision: number,
): Promise<void> {
  await executeTransaction([
    {
      sql: `INSERT INTO local_meeting_board_revisions
      (id, session_id, revision, board_json, created_at)
      SELECT ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM sessions WHERE id = ? AND deleted_at IS NULL)
      AND COALESCE((SELECT MAX(revision) FROM local_meeting_board_revisions WHERE session_id = ?), 0) = ?`,
      params: [
        crypto.randomUUID(),
        board.meetingId,
        board.revision,
        JSON.stringify(board),
        Date.now(),
        board.meetingId,
        board.meetingId,
        previousRevision,
      ],
      expectedRowsAffected: 1,
    },
  ]);
}
