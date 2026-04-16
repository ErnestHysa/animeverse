#!/usr/bin/env node

/**
 * Unified Development Server
 * Starts the local Next.js app and, when available, a sibling Consumet API.
 */

const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${ANSI.cyan}[INFO]${ANSI.reset} ${msg}`),
  success: (msg) => console.log(`${ANSI.green}[READY]${ANSI.reset} ${msg}`),
  error: (msg) => console.log(`${ANSI.red}[ERROR]${ANSI.reset} ${msg}`),
  api: (msg) => console.log(`${ANSI.yellow}[API]${ANSI.reset} ${msg}`),
  next: (msg) => console.log(`${ANSI.blue}[NEXT]${ANSI.reset} ${msg}`),
};

let apiReady = false;
let nextReady = false;
const apiLines = [];
const nextLines = [];

function spawnProcess(name, command, args, cwd, readyPattern, onReady) {
  log.info(`Starting ${name}...`);

  const proc = spawn(command, args, {
    cwd,
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: "1",
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
    },
  });

  proc.stdout.on("data", (data) => {
    const output = data.toString();
    const lines = output.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (name === "API") {
        log.api(line);
        if (apiLines.length > 1000) apiLines.shift();
        apiLines.push(line);
      } else {
        log.next(line);
        if (nextLines.length > 1000) nextLines.shift();
        nextLines.push(line);
      }

      if (!apiReady && name === "API" && readyPattern && line.match(readyPattern)) {
        apiReady = true;
        log.success("Consumet API is ready on http://localhost:3001");
        onReady("api");
      }

      if (!nextReady && name === "Next" && line.match(/ready|started|localhost:3000/i)) {
        nextReady = true;
        log.success("Next.js app is ready on http://localhost:3000");
        onReady("next");
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const output = data.toString();
    const lines = output.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (name === "API") {
        log.api(line);
        if (apiLines.length > 1000) apiLines.shift();
        apiLines.push(line);
      } else {
        log.next(line);
        if (nextLines.length > 1000) nextLines.shift();
        nextLines.push(line);
      }
    }
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log.error(`${name} exited with code ${code}`);
    }
  });

  return proc;
}

function openBrowser(url) {
  const start =
    process.platform === "win32"
      ? "start"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  spawn(start, [url], { shell: true });
}

async function main() {
  console.log(`${ANSI.bright}${ANSI.cyan}
+------------------------------------------------------+
|   Anime Stream - Unified Development Server         |
+------------------------------------------------------+
${ANSI.reset}`);

  const rootDir = path.resolve(__dirname, "..");
  const consumetDir = path.resolve(rootDir, "..", "consumet");

  log.info(`Project: ${rootDir}`);
  log.info(`Consumet: ${consumetDir}`);

  let apiProc = null;
  let nextProc = null;

  if (fs.existsSync(consumetDir)) {
    try {
      apiProc = spawnProcess(
        "API",
        "npm",
        ["run", "dev"],
        consumetDir,
        /server.*listening|ready/i,
        (service) => {
          if (service === "api" && nextReady) {
            openBrowser("http://localhost:3000");
          }
        }
      );
    } catch (err) {
      log.error(`Failed to start Consumet API: ${err.message}`);
      log.info("Continuing with Next.js only...");
    }
  } else {
    log.info("No sibling Consumet API found, starting Next.js only.");
  }

  setTimeout(() => {
    log.info("Starting Next...");

    nextProc = spawn("node", ["scripts/start-next-webpack.mjs"], {
      cwd: rootDir,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: "1",
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
    });

    nextProc.stdout.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        log.next(line);
        if (nextLines.length > 1000) nextLines.shift();
        nextLines.push(line);

        if (!nextReady && line.match(/ready|started|localhost:3000/i)) {
          nextReady = true;
          log.success("Next.js app is ready on http://localhost:3000");
          if (apiReady || !fs.existsSync(consumetDir)) {
            openBrowser("http://localhost:3000");
          }
        }
      }
    });

    nextProc.stderr.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        log.next(line);
        if (nextLines.length > 1000) nextLines.shift();
        nextLines.push(line);
      }
    });

    nextProc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        log.error(`Next exited with code ${code}`);
      }
    });
  }, 2000);

  const shutdown = () => {
    console.log(`\n${ANSI.yellow}Shutting down...${ANSI.reset}`);
    if (apiProc) apiProc.kill();
    if (nextProc) nextProc.kill();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
