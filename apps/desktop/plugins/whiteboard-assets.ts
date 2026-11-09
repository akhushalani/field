import { cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Use the SDK's own font assets and notices; the board must not need a font CDN.
export function prepareWhiteboardFonts(publicDirectory: string) {
  cpSync(
    fileURLToPath(
      new URL(
        "../node_modules/@excalidraw/excalidraw/dist/prod/fonts",
        import.meta.url,
      ),
    ),
    join(publicDirectory, "meetingboard-fonts"),
    { recursive: true },
  );
}
