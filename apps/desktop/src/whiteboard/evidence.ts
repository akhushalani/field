import type { Evidence } from "./core";

import type { TranscriptRecord } from "~/stt/queries";

export function transcriptEvidence(
  transcripts: TranscriptRecord[],
): Evidence[] {
  return transcripts.flatMap((transcript) => {
    const chunks: Evidence[] = [];
    for (let index = 0; index < transcript.words.length; index += 24) {
      const words = transcript.words.slice(index, index + 24);
      const first = words[0];
      const last = words[words.length - 1];
      if (!first || !last) continue;
      chunks.push({
        id: `${transcript.id}:${first.id}`,
        text: words.map((word) => word.text).join(" "),
        startMs: transcript.startedAt + (first.start_ms ?? 0),
        endMs: transcript.startedAt + (last.end_ms ?? first.start_ms ?? 0),
      });
    }
    return chunks;
  });
}
