# Thrad Meetingboard development fork

Primary foundation: `fastrepl/anarlog` at `0a97fcd408aa62230484787e462be4b56bd4f1ee`.
Reference foundation: `estebanstifli/Meet2Notes` at `b75077e588f5623d48d9c9bac05aa428b4257c52`, forked separately as `akhushalani/meet2notes-reference`.

This branch contains the semantic board engine, a structured-board view, a live transcript adapter, selected-model integration, and local SQLite revision persistence. It is development groundwork, not a completed native pilot. The original foundation gate remains open until the Mac app builds and recording, transcription, notes, exports, MCP, latency and restart recovery have been exercised on the isolated profile. Excalidraw, ELK layout, a full 20-minute model-quality replay and board-specific MCP/export remain pending.

## Run the isolated app

Use Node 22 or 24, pnpm 11.1.1, Rust 1.94.0, and the native prerequisites in the upstream README. On Apple Silicon, verify `xcrun -sdk macosx metal --version`; having Xcode alone is insufficient.

```sh
pnpm install --frozen-lockfile
pnpm -F @anlg/ui build
node scripts/dev-meetingboard.mjs
```

The launcher uses `ai.thrad.meetingboard.dev`, a separate development signing identity, and the corresponding development data directory. It disables Sentry, omits the analytics key, disables updater delivery and removes inherited CloudSync configuration. This isolation is for `tauri dev`; do not assume an ordinary release build uses the same data-directory rules. Do not point this fork at an existing Anarlog vault.

Configure a direct AI provider and model in the isolated app's AI settings. Credentials belong in the app, never in this repository or chat. Configure transcription separately if the selected speech provider requires it. Open a meeting, choose **Open meeting board**, and start updates when ready to send transcript excerpts and board content to the selected model. Upstream-hosted model connections are not used by this feature.

Updates are opt-in and start paused after reopening. While enabled, the controller checks for changed finalized transcript evidence every 10 seconds and permits structural rethinking about every 45 seconds. These are scheduling intervals, not measured end-to-end latency guarantees. Requests are serial, time out after 40 seconds and do not retry automatically. Model failures pause board updates without changing the recording pipeline.

**Edit** also protects a card from AI changes. **Keep** protects its text and topic without editing. **Release** allows AI changes again. **Hide** creates a human-protected tombstone; AI-archived cards may return if the discussion revisits them. **Undo** restores the preceding accepted state as a new revision. Evidence links identify transcript excerpts; they establish provenance, not correctness of the model's interpretation.

Board history lives in `local_meeting_board_revisions`, deliberately outside CloudSync. Writes use an atomic revision check. Reads exclude deleted sessions, and permanent session deletion removes their board history. Existing note summaries, recording and transcript storage use the upstream paths. The board controller currently runs while that meeting's session component is mounted; a background service independent of tab lifetime is pending.

## Offline replay and verification

```sh
pnpm -F @anlg/desktop test -- src/whiteboard --maxWorkers=1
pnpm -F @anlg/desktop typecheck
cargo check --locked -p anarlog-cli
cargo test --locked -p db-app meeting_board_migration
pnpm -F @anlg/desktop exec vite --config scripts/whiteboard-preview/vite.config.ts
```

The last command serves a clearly labeled, synthetic replay of the actual board view at `http://127.0.0.1:1430`. It does not record audio or call a provider, and changes last until refresh. Its disabled start button is intentional. It is not evidence that native recording, real model quality or restart recovery works.

`meet2notes.fixture.jsonl` is produced by the reference fork's `scripts/export_whiteboard_replay.py`, using Meet2Notes' actual webhook serializer. The offline adapter accepts ordered `live.segment.batch` events, applies segment corrections by stable ID, ignores duplicate delivery and rejects missing batches or cross-meeting input. It exposes no network webhook endpoint.

The structured view is intentionally small enough to validate the transcript → semantic state → revision persistence loop. The planned editable canvas, annotations, relationships and alternative layouts are subsequent work after the foundation gate is cleared.
