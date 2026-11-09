import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { prepareWhiteboardFonts } from "../../plugins/whiteboard-assets";

prepareWhiteboardFonts(fileURLToPath(new URL("./public", import.meta.url)));

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  plugins: [react()],
  css: { postcss: fileURLToPath(new URL("../../", import.meta.url)) },
  server: {
    host: "127.0.0.1",
    port: 1430,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../../../../", import.meta.url))] },
  },
});
