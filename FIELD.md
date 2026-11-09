# Field development fork

Field is the product name. The existing `ai.thrad.meetingboard.dev` signing identifier and data directory remain stable across this rename so local notes, credentials and OS grants keep their identity.

Primary foundation: `fastrepl/anarlog` at `0a97fcd408aa62230484787e462be4b56bd4f1ee`.
Reference foundation: `estebanstifli/Meet2Notes` at `b75077e588f5623d48d9c9bac05aa428b4257c52`, forked separately as `akhushalani/meet2notes-reference`.

This branch contains the semantic board engine, Cards and Canvas views, a live transcript adapter, selected-model integration, and local SQLite revision persistence. Canvas uses Excalidraw with ELK layout in a worker. It is development groundwork, not a completed native pilot. The original foundation gate remains open until the Mac app builds and recording, transcription, notes, exports, MCP, latency and restart recovery have been exercised on the isolated profile. A full 20-minute model-quality replay and board-specific MCP/export remain pending.

## Run the isolated app

Use Node 22 or 24, pnpm 11.1.1, Rust 1.94.0, CMake on PATH (or the `CMAKE` executable override), and the native prerequisites in the upstream README. On Apple Silicon, verify `xcrun -sdk macosx metal --version`; having Xcode alone is insufficient.

```sh
pnpm install --frozen-lockfile
pnpm -F @anlg/ui build
node scripts/dev-field.mjs
```

The isolated launcher defaults to two Cargo jobs, no Rust debug symbols, and no symbol stripping. These match the native proof profile and keep subsequent launches on the same build cache; explicit `CARGO_BUILD_JOBS`, `CARGO_PROFILE_DEV_DEBUG` and `CARGO_PROFILE_DEV_STRIP` overrides remain available.

The launcher uses `ai.thrad.meetingboard.dev`, a separate development signing identity, and the corresponding development data directory. It disables Sentry, omits the analytics key, disables updater delivery and removes inherited CloudSync configuration. This isolation is for `tauri dev`; do not assume an ordinary release build uses the same data-directory rules. Do not point this fork at an existing Anarlog vault.

On macOS, the isolated runner uses Tauri’s bundler to wrap the cached binary as **Field Dev.app**, copies it into the current user’s temporary directory, then signs, verifies and launches that runtime bundle. The runner clears Finder display metadata and verifies the signature immediately before launch; macOS may add display metadata again after application registration. Meeting data stays in the existing application-support directory. It still depends on the Vite development server, so start it through the launcher above. The named bundle supports macOS application discovery and the permission assistant’s app-icon drag action.

The upstream `dev` feature also enables its existing file-backed audio provider. It remains inactive unless `MOCK_AUDIO` is set. For a silent synthetic capture test, set `MOCK_AUDIO=1`, `MOCK_PLAYBACK=0`, `ANLG_MOCK_MIC_AUDIO` to a generated speech file and `ANLG_MOCK_SPK_AUDIO` to a silence file before launching. This exercises the live stream without recording the room; it does not prove physical microphone or system-audio capture.

On Xcode 27, SwiftPM places static libraries under `out/Products`. The shared `scripts/swift-link-compat.rs` helper adds SwiftPM’s stable `debug`/`release` alias to the linker search paths for all native Swift bridges, alongside the older paths emitted by the pinned swift-rs dependency. The helper also makes the pinned SwiftRs runtime’s four Rust-facing C entry points public in build-local dependency checkouts: Xcode 27 release optimization otherwise omits the internal exports. Their implementation stays unchanged. Fresh checkouts are resolved before patching, and original file permissions are restored.

The development relay uses `http://127.0.0.1:1431` for this profile, independently of upstream's default relay port. That relay currently forwards commands and events but not the Tauri data channels used by database subscriptions; use the native app to verify the full desktop UI. The synthetic UI-only replay remains on port 1430.

Configure a direct AI provider and model in the isolated app's AI settings. Credentials belong in the app, never in this repository or chat. Configure transcription separately if the selected speech provider requires it. Open a meeting, choose **Open meeting board**, and start updates when ready to send transcript excerpts and board content to the selected model. Upstream-hosted model connections are not used by this feature.

Updates are opt-in and start paused after reopening. While enabled, the controller checks for changed finalized transcript evidence every 10 seconds and permits structural rethinking about every 45 seconds. These are scheduling intervals, not measured end-to-end latency guarantees. Requests are serial, time out after 40 seconds and do not retry automatically. Model failures pause board updates without changing the recording pipeline.

**Edit** also protects a card from AI changes. **Keep** protects its text and topic without editing. **Release** allows AI changes again. **Hide** creates a human-protected tombstone; AI-archived cards may return if the discussion revisits them. **Undo** restores the preceding accepted state as a new revision. Evidence links identify transcript excerpts; they establish provenance, not correctness of the model's interpretation.

Board history lives in `local_meeting_board_revisions`, deliberately outside CloudSync. Writes use an atomic revision check. Reads exclude deleted sessions, and permanent session deletion removes their board history. Existing note summaries, recording and transcript storage use the upstream paths. The board controller currently runs while that meeting's session component is mounted; a background service independent of tab lifetime is pending.

## Offline replay and verification

```sh
pnpm -F @anlg/desktop exec vitest run src/whiteboard --maxWorkers=1
pnpm -F @anlg/desktop typecheck
cargo check --locked -p anarlog-cli
cargo test --locked -p db-app meeting_board_migration
pnpm -F @anlg/desktop exec vite --config scripts/whiteboard-preview/vite.config.ts
```

The last command serves a clearly labeled, synthetic replay of the actual board view at `http://127.0.0.1:1430`. It does not record audio or call a provider, and changes last until refresh. Its disabled start button is intentional. It is not evidence that native recording, real model quality or restart recovery works.

For a short native audio smoke test on a Mac, run `python3 scripts/make-meetingboard-fixture.py /tmp/meetingboard-proof`. This uses the installed Samantha voice to create speech, silence and a hash/duration manifest without playing sound or recording the room. It is separate from the 20-minute acceptance benchmark.

`meet2notes.fixture.jsonl` is produced by the reference fork's `scripts/export_whiteboard_replay.py`, using Meet2Notes' actual webhook serializer. The offline adapter accepts ordered `live.segment.batch` events, applies segment corrections by stable ID, ignores duplicate delivery and rejects missing batches or cross-meeting input. It exposes no network webhook endpoint.

Cards and Canvas share one semantic state and revision history. In Canvas, select a card or use the card list to inspect evidence, edit, keep, release or hide it. Pan and zoom use Excalidraw; automatic topic grouping uses ELK in a worker. Canvas geometry is a projection of the board, not a separate editor history. Freehand annotations, manual positioning, relationships, mind-map layout and incremental layout stability remain subsequent work after the foundation gate is cleared.

Excalidraw 0.18.1 and ELK 0.12.1 are pinned. The build copies Excalidraw's supplied font assets and font notices locally; it does not require a font CDN. Library license texts ship in `apps/desktop/public/meetingboard-notices`. Integration follows the [Excalidraw SDK API](https://plus.excalidraw.com/docs/sdk/excalidraw/api/props/excalidraw-api) and [ELK worker API](https://github.com/kieler/elkjs#usage).
