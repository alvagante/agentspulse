import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { PluginRegistry } from "./plugins/plugin-registry.js";
import { getAllPluginCandidates } from "./plugins/index.js";
import { SessionStore } from "./store/session-store.js";
import { Scanner } from "./scanner/scanner.js";
import { ConfigViewer } from "./scanner/config-viewer.js";
import { createApiRouter } from "./api/routes.js";
import type { AppConfig } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG: AppConfig = {
  port: parsePort(process.env.AGENTS_PULSE_PORT) ?? 4040,
  host: process.env.AGENTS_PULSE_HOST ?? "127.0.0.1",
  projectRoots: [
    join(homedir(), "work"),
    join(homedir(), "personal"),
    join(homedir(), "Documents"),
  ],
  scanIntervalMs: 0,
  configPath: join(homedir(), ".agentspulse", "config.json"),
};

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined;
}

async function loadConfig(): Promise<AppConfig> {
  const configPath = join(homedir(), ".agentspulse", "config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      configPath,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function main(): Promise<void> {
  const config = await loadConfig();

  // Initialize plugin registry with autodiscovery
  const registry = new PluginRegistry();
  const candidates = getAllPluginCandidates();
  await registry.autodiscover(candidates);

  // Initialize store, scanner, config viewer
  const store = new SessionStore();
  const scanner = new Scanner(registry, store, config.projectRoots);
  // Fix #1: restrict to known tool config dirs instead of entire home directory
  const toolConfigBases = getAllPluginCandidates()
    .flatMap((p) => p.configDirNames.map((d) => join(homedir(), d)));
  const allowedBases = [...config.projectRoots, ...toolConfigBases];
  const configViewer = new ConfigViewer(allowedBases);

  // Run initial full scan
  console.log("Running initial filesystem scan...");
  const scanResult = await scanner.fullScan();
  console.log(
    `Scan complete: ${scanResult.sessions.length} sessions, ${scanResult.projects.length} projects, ${scanResult.configs.length} configs (${scanResult.durationMs}ms)`
  );
  if (scanResult.errors.length > 0) {
    console.log(`Scan warnings: ${scanResult.errors.length} errors encountered`);
  }

  // Create Express app
  const app = express();
  app.use(helmet());
  app.use(express.json());

  // Fix #2: DNS rebinding protection — reject requests with unexpected Host header
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const host = req.hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      res.status(400).json({ error: "Bad Request" });
      return;
    }
    next();
  });

  // Optional API key auth (set AGENTS_PULSE_API_KEY env var to enable)
  const apiKey = process.env.AGENTS_PULSE_API_KEY;
  if (apiKey) {
    app.use("/api", (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.headers["x-api-key"] !== apiKey) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }

  // Rate limiting
  app.use("/api/rescan", rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false }));
  app.use("/api", rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

  // Mount API router
  const apiRouter = createApiRouter({ store, scanner, configViewer, registry });
  app.use("/api", apiRouter);

  // Serve static SPA files
  const staticDir = join(__dirname, "..", "..", "web", "dist");
  app.use(express.static(staticDir));

  // SPA fallback: any non-/api GET request serves index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(join(staticDir, "index.html"), (err) => {
      if (err) {
        // If index.html doesn't exist yet (dev mode), return a simple message
        res.status(200).send("AgentsPulse — frontend not built yet. Run: npm run build:web");
      }
    });
  });

  // Error handling middleware
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Unhandled error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`AgentsPulse running at http://${config.host}:${config.port}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.port} is already in use. Please choose a different port.`
      );
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error("Failed to start AgentsPulse:", err);
  process.exit(1);
});
