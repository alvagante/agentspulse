import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type {
  ToolId,
  ArtifactCategory,
  Session,
  SessionEvent,
} from "../types.js";
import { querySqliteJson } from "../sqlite.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

interface ZedThreadRow {
  id: string;
  summary: string;
  updated_at: string;
  created_at: string | null;
  data_type: string;
  folder_paths: string | null;
}

/**
 * Zed plugin — discovers Zed config/artifacts and parses Assistant threads.
 *
 * Zed stores assistant threads in
 * ~/Library/Application Support/Zed/threads/threads.db.
 */
export class ZedPlugin extends BasePlugin {
  readonly id: ToolId = "zed";
  readonly displayName = "Zed";
  readonly color = "#7c5cff";
  readonly artifactCategories: ArtifactCategory[] = ["config", "agents", "memory"];
  readonly configDirNames = [".config/zed", "Library/Application Support/Zed"];
  readonly commandNames = ["zed"];
  readonly systemPaths = ["/etc/zed/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
    { relativePath: "keymap.json" },
    { relativePath: "tasks.json" },
    { relativePath: "themes.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "prompts", category: "agents", isDirectory: true },
    { relativePath: "extensions/installed", category: "agents", isDirectory: true },
    { relativePath: "external_agents/registry", category: "agents", isDirectory: true },
  ];

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions = await this.readThreads();
    return sessions.filter((session) => session.projectPath === projectPath);
  }

  override async parseSessionFile(filePath: string): Promise<Session | null> {
    const sessions = await this.readThreads(filePath);
    return sessions[0] ?? null;
  }

  override async discoverArtifacts(scope: Parameters<BasePlugin["discoverArtifacts"]>[0]) {
    const artifacts = await super.discoverArtifacts(scope);
    if (scope.level !== "user-home") return artifacts;

    const threadsDb = join(
      scope.basePath,
      "Library",
      "Application Support",
      "Zed",
      "threads",
      "threads.db"
    );
    try {
      const s = await stat(threadsDb);
      artifacts.push({
        path: threadsDb,
        toolId: this.id,
        category: "memory",
        scope: scope.level,
        fileType: "other",
        size: s.size,
        lastModified: s.mtime,
      });
    } catch {
      // No Zed threads DB
    }

    return artifacts;
  }

  private async readThreads(
    dbPath = join(homedir(), "Library", "Application Support", "Zed", "threads", "threads.db")
  ): Promise<Session[]> {
    const rows = await querySqliteJson<ZedThreadRow>(
      dbPath,
      `select id, summary, updated_at, created_at, data_type, folder_paths
       from threads`
    );

    return rows.map((row) => this.toSession(row, dbPath)).filter(Boolean);
  }

  private toSession(row: ZedThreadRow, dbPath: string): Session {
    const startedAt = parseDate(row.created_at) ?? parseDate(row.updated_at) ?? new Date(0);
    const endedAt = parseDate(row.updated_at);
    const projectPath = firstZedFolderPath(row.folder_paths);
    const events: SessionEvent[] = row.summary
      ? [{ type: "assistant_response", timestamp: endedAt ?? startedAt, text: row.summary }]
      : [];

    return {
      id: row.id,
      toolId: this.id,
      title: row.summary || row.id,
      status: "done",
      projectPath,
      projectName: basename(projectPath || dbPath),
      startedAt,
      endedAt,
      durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : 0,
      model: "unknown",
      tokens: { used: 0, limit: 0 },
      estimatedCost: 0,
      messageCount: events.length,
      toolCallCount: 0,
      filesModified: [],
      netLines: { additions: 0, deletions: 0 },
      events,
      sourceFiles: [dbPath],
      config: { model: "unknown", tools: [], agent: row.data_type },
    };
  }
}

function firstZedFolderPath(value: string | null): string {
  if (!value) return "";
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    return parsed.find((item): item is string => typeof item === "string") ?? "";
  }
  return value.split("\n").find(Boolean) ?? "";
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
