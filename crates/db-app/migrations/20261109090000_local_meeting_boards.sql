-- Board history stays on this device; deliberately absent from CloudSync policy.
CREATE TABLE local_meeting_board_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  board_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, revision)
);
CREATE TRIGGER local_meeting_board_session_cleanup
AFTER DELETE ON sessions
BEGIN
  DELETE FROM local_meeting_board_revisions WHERE session_id = OLD.id;
END;
