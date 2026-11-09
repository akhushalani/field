#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const [command, ...args] = process.argv.slice(2);
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

if (!command) {
  console.error("Expected a Cargo command or Tauri application binary path.");
  process.exit(1);
}

if (command === "run" || command === "build") {
  const cargoArgs = [];
  if (command === "run" && process.platform === "darwin") {
    cargoArgs.push(
      "--config",
      `target.'cfg(target_os = "macos")'.runner = [${JSON.stringify(scriptPath)}]`,
    );
  }
  cargoArgs.push(command, ...args);
  runChild("cargo", cargoArgs);
} else {
  let executable = command;
  if (process.platform === "darwin") {
    let signingTarget = command;
    if (
      process.env.ANARLOG_DEV_APP_IDENTIFIER === "ai.thrad.meetingboard.dev"
    ) {
      signingTarget = bundleField(command);
      executable = resolve(signingTarget, "Contents/MacOS", basename(command));
    }
    signBinary(signingTarget);
  }
  runChild(executable, args);
}

function bundleField(binary) {
  // A named .app gives the isolated pilot a stable macOS application identity.
  const desktopDirectory = resolve(dirname(scriptPath), "..");
  const bundle = spawnSync(
    process.execPath,
    [
      resolve(desktopDirectory, "node_modules/@tauri-apps/cli/tauri.js"),
      "bundle",
      "--debug",
      "--bundles",
      "app",
      "--features",
      "direct-distribution,dev",
      "--config",
      "src-tauri/tauri.field.conf.json",
      "--config",
      JSON.stringify({ mainBinaryName: basename(binary) }),
      "--no-sign",
    ],
    { cwd: desktopDirectory, stdio: "inherit" },
  );
  if (bundle.status !== 0) process.exit(bundle.status ?? 1);
  return resolve(dirname(resolve(binary)), "bundle/macos/Field Dev.app");
}

function signBinary(binary) {
  const identifier =
    process.env.ANARLOG_DEV_APP_IDENTIFIER || "com.hyprnote.dev";
  const scriptDirectory = dirname(scriptPath);
  const entitlements = resolve(
    scriptDirectory,
    "../src-tauri/Entitlements.plist",
  );
  const signing = spawnSync(
    "codesign",
    [
      "--force",
      ...(binary.endsWith(".app") ? ["--deep"] : []),
      "--sign",
      "-",
      "--identifier",
      identifier,
      "--requirements",
      `=designated => identifier "${identifier}"`,
      "--entitlements",
      entitlements,
      binary,
    ],
    { stdio: "inherit" },
  );

  if (signing.status !== 0) {
    process.exit(signing.status ?? 1);
  }
}

function runChild(executable, childArgs) {
  const child = spawn(executable, childArgs, { stdio: "inherit" });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(signalExitCodes[signal] ?? 1);
      return;
    }

    process.exit(code ?? 1);
  });
}
