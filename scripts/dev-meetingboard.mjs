import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = {
  ...process.env,
  ANARLOG_DISABLE_SENTRY: "1",
  ANARLOG_DEV_APP_IDENTIFIER: "ai.thrad.meetingboard.dev",
  RELAY_PORT: "1431",
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || "2",
  CARGO_PROFILE_DEV_DEBUG: process.env.CARGO_PROFILE_DEV_DEBUG || "0",
  CARGO_PROFILE_DEV_STRIP: process.env.CARGO_PROFILE_DEV_STRIP || "none",
};
delete env.POSTHOG_API_KEY;
for (const key of Object.keys(env)) {
  if (key.startsWith("ANARLOG_CLOUDSYNC_")) delete env[key];
}

if (process.platform === "darwin") {
  const cmake = spawnSync(env.CMAKE || "cmake", ["--version"], {
    env,
    stdio: "ignore",
  });
  if (cmake.status !== 0) {
    console.error(
      "CMake missing. Install CMake and add it to PATH, or set CMAKE to its executable, before starting the native build. See THRAD.md.",
    );
    process.exit(1);
  }
  const developerDir = "/Applications/Xcode.app/Contents/Developer";
  if (!env.DEVELOPER_DIR && existsSync(developerDir))
    env.DEVELOPER_DIR = developerDir;
  const metal = spawnSync("xcrun", ["-sdk", "macosx", "metal", "--version"], {
    env,
    stdio: "ignore",
  });
  if (metal.status !== 0) {
    console.error(
      "Metal compiler missing. Install Metal Toolchain in Xcode → Settings → Components before starting the native build. See THRAD.md.",
    );
    process.exit(1);
  }
}

const child = spawn(
  "pnpm",
  [
    "-F",
    "@anlg/desktop",
    "tauri",
    "dev",
    "--no-watch",
    "--features",
    "dev",
    "--config",
    "src-tauri/tauri.thrad.conf.json",
  ],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env,
    stdio: "inherit",
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
