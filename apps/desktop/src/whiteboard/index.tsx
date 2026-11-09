import { useBoard } from "./use-board";
import { MeetingBoardView } from "./view";

export function MeetingBoard({
  meetingId,
  enabled,
}: {
  meetingId: string;
  enabled: boolean;
}) {
  const state = useBoard(meetingId, enabled);
  return <MeetingBoardView state={state} enabled={enabled} />;
}
