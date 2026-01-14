#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const IS_WINDOWS = os.platform() === "win32";

// Get the directory where this module is located (resilient to npx/npm install)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up one level from build/ to package root
const PACKAGE_ROOT = path.resolve(__dirname, "..");

// Where screenshots will be saved (user's working directory)
const PROJECT_ROOT = process.cwd();
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "screenshots");
// EXE path is relative to package installation directory
const EXE_PATH = path.join(PACKAGE_ROOT, "bin", "RegionSnip.exe");

async function ensureReady() {
  if (!IS_WINDOWS) {
    throw new Error("This MCP server is Windows-only for now.");
  }
  if (!existsSync(EXE_PATH)) {
    throw new Error(`Missing helper EXE at: ${EXE_PATH}`);
  }
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

function makeScreenshotPath(prefix: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(SCREENSHOTS_DIR, `${prefix}-${stamp}.png`);
}

/**
 * Runs RegionSnip.exe and parses the JSON it prints to stdout.
 * Your EXE should support:
 *  - --mode full|region
 *  - --out <path>
 *  - optional: --all, --monitor <n>
 */
async function runHelper(args: string[], timeoutMs = 120_000): Promise<any> {
  await ensureReady();

  return await new Promise((resolve, reject) => {
    const child = spawn(EXE_PATH, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const killTimer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill();
            reject(new Error(`Helper timed out after ${timeoutMs}ms`));
          }, timeoutMs)
        : null;

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

    child.on("error", (err) => {
      if (killTimer) clearTimeout(killTimer);
      reject(err);
    });

    child.on("close", (code) => {
      if (killTimer) clearTimeout(killTimer);

      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(
          new Error(
            `Helper produced no stdout JSON. Exit=${code}. stderr=${stderr.trim()}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        resolve(parsed);
      } catch (e) {
        reject(
          new Error(
            `Failed to parse helper JSON.\nstdout=${trimmed}\nstderr=${stderr.trim()}`
          )
        );
      }
    });
  });
}

async function fileToBase64(p: string) {
  const buf = await fs.readFile(p);
  return buf.toString("base64");
}

// ---------------- MCP Server ----------------

const server = new McpServer(
  { name: "windows-screenshots", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// 1) takeScreenshot (fullscreen)
server.tool(
  "takeScreenshot",
  {
    mode: z.literal("full").optional().default("full"),
    allMonitors: z.boolean().optional().default(true),
    monitor: z.number().int().min(0).optional(),
    includeImage: z.boolean().optional().default(false),
    timeoutMs: z.number().int().min(0).optional().default(60_000),
  },
  async ({ allMonitors, monitor, includeImage, timeoutMs }) => {
    const outPath = makeScreenshotPath("full");

    const args: string[] = ["--mode", "full", "--out", outPath];
    if (allMonitors) args.push("--all");
    if (monitor !== undefined) args.push("--monitor", String(monitor));

    const result = await runHelper(args, timeoutMs);

    // Optionally embed the image in the MCP tool result as base64 (image/png)
    // MCP supports image content items. :contentReference[oaicite:4]{index=4}
    const content: any[] = [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: result.ok,
            cancelled: result.cancelled ?? false,
            path: outPath,
            rect: result.rect,
            width: result.width,
            height: result.height,
            mode: "full",
            allMonitors,
            monitor: monitor ?? null,
          },
          null,
          2
        ),
      },
    ];

    if (includeImage && result.ok) {
      const b64 = await fileToBase64(outPath);
      content.push({ type: "image", data: b64, mimeType: "image/png" });
    }

    return { content, isError: !result.ok };
  }
);

// 2) takeSelectedAreaScreenshot (interactive)
server.tool(
  "takeSelectedAreaScreenshot",
  {
    mode: z.literal("region").optional().default("region"),
    includeImage: z.boolean().optional().default(false),
    timeoutMs: z.number().int().min(0).optional().default(120_000),
  },
  async ({ includeImage, timeoutMs }) => {
    const outPath = makeScreenshotPath("region");

    const args: string[] = ["--mode", "region", "--out", outPath];
    const result = await runHelper(args, timeoutMs);

    const content: any[] = [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: result.ok,
            cancelled: result.cancelled ?? false,
            path: outPath,
            rect: result.rect,
            width: result.width,
            height: result.height,
            mode: "region",
          },
          null,
          2
        ),
      },
    ];

    if (includeImage && result.ok) {
      const b64 = await fileToBase64(outPath);
      content.push({ type: "image", data: b64, mimeType: "image/png" });
    }

    return { content, isError: !result.ok };
  }
);

// 3) listScreenshots
server.tool(
  "listScreenshots",
  {
    limit: z.number().int().min(1).max(200).optional().default(50),
  },
  async ({ limit }) => {
    await ensureReady();

    const files = await fs.readdir(SCREENSHOTS_DIR);
    const pngs = files
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .map((f) => path.join(SCREENSHOTS_DIR, f));

    const stats = await Promise.all(
      pngs.map(async (p) => {
        const st = await fs.stat(p);
        return { path: p, sizeBytes: st.size, createdMs: st.birthtimeMs };
      })
    );

    stats.sort((a, b) => b.createdMs - a.createdMs);

    const items = stats.slice(0, limit).map((s) => ({
      path: s.path,
      sizeBytes: s.sizeBytes,
      createdAt: new Date(s.createdMs).toISOString(),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify({ items }, null, 2) }],
    };
  }
);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
