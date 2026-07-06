import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type {
  ToolId,
  ArtifactCategory,
  Session,
  SessionEvent,
  FileChange,
} from "../types.js";
import { querySqliteJson } from "../sqlite.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

interface CursorKvRow {
  key: string;
  value: string | null;
}

interface CursorComposerHeader {
  composerId?: string;
  name?: string;
  subtitle?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  status?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
  workspaceIdentifier?: {
    id?: string;
    uri?: {
      fsPath?: string;
      path?: string;
    };
  };
}

interface CursorComposerData {
  composerId?: string;
  name?: string;
  subtitle?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  status?: string;
  isDraft?: boolean;
  isArchived?: boolean;
  unifiedMode?: string;
  modelConfig?: Record<string, unknown>;
  fullConversationHeadersOnly?: Array<{
    type?: number;
    grouping?: Record<string, unknown>;
  }>;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
  workspaceIdentifier?: CursorComposerHeader["workspaceIdentifier"];
}

/**
 * Cursor plugin — discovers Cursor config, workspace data, and composer sessions.
 *
 * Cursor stores global composer headers in the VS Code-style global state DB:
 * ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb on macOS.
 */
export class CursorPlugin extends BasePlugin {
  readonly id: ToolId = "cursor";
  readonly displayName = "Cursor";
  readonly color = "#2f7de1";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "agents",
    "steering",
    "memory",
  ];
  readonly configDirNames = [
    ".cursor",
    "Library/Application Support/Cursor/User",
  ];
  readonly commandNames = ["cursor"];
  readonly systemPaths = ["/etc/cursor/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "argv.json" },
    { relativePath: "settings.json" },
    { relativePath: "globalStorage/storage.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "rules", category: "steering", isDirectory: true },
    { relativePath: "skills-cursor", category: "agents", isDirectory: true },
    { relativePath: "projects", category: "memory", isDirectory: true },
  ];

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions = await this.readComposerSessions();
    return sessions.filter((session) => session.projectPath === projectPath);
  }

  override async parseSessionFile(filePath: string): Promise<Session | null> {
    if (!filePath.endsWith(".json")) return null;

    try {
      const data = JSON.parse(await readFile(filePath, "utf-8")) as CursorComposerData;
      return this.toSession(data, filePath);
    } catch {
      return null;
    }
  }

  private async readComposerSessions(): Promise<Session[]> {
    const stateDb = join(
      homedir(),
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );

    const rows = await querySqliteJson<CursorKvRow>(
      stateDb,
      `select key, cast(value as text) as value
       from ItemTable
       where key = 'composer.composerHeaders'
          or key like 'composerData:%'
       union all
       select key, cast(value as text) as value
       from cursorDiskKV
       where key like 'composerData:%'`
    );

    const headers = this.parseComposerHeaders(rows);
    const composerData = this.parseComposerData(rows);
    const sessions: Session[] = [];

    for (const header of headers) {
      const data = header.composerId ? composerData.get(header.composerId) : undefined;
      sessions.push(this.toSession({ ...header, ...data }, stateDb));
    }

    for (const [composerId, data] of composerData) {
      if (headers.some((header) => header.composerId === composerId)) continue;
      sessions.push(this.toSession(data, stateDb));
    }

    return sessions.filter((session) => session.projectPath !== "");
  }

  private parseComposerHeaders(rows: CursorKvRow[]): CursorComposerHeader[] {
    const row = rows.find((item) => item.key === "composer.composerHeaders");
    if (!row?.value) return [];

    try {
      const parsed = JSON.parse(row.value) as { allComposers?: CursorComposerHeader[] };
      return Array.isArray(parsed.allComposers) ? parsed.allComposers : [];
    } catch {
      return [];
    }
  }

  private parseComposerData(rows: CursorKvRow[]): Map<string, CursorComposerData> {
    const result = new Map<string, CursorComposerData>();
    for (const row of rows) {
      if (!row.key.startsWith("composerData:") || !row.value) continue;
      try {
        const parsed = JSON.parse(row.value) as CursorComposerData;
        const composerId = parsed.composerId ?? row.key.slice("composerData:".length);
        if (composerId) result.set(composerId, parsed);
      } catch {
        // Skip malformed composer data
      }
    }
    return result;
  }

  private toSession(data: CursorComposerData, sourceFile: string): Session {
    const id = data.composerId || this.generateSessionId(sourceFile);
    const startedAt = fromMillis(data.createdAt) ?? new Date(0);
    const endedAt = fromMillis(data.lastUpdatedAt);
    const projectPath =
      data.workspaceIdentifier?.uri?.fsPath ??
      data.workspaceIdentifier?.uri?.path ??
      "";
    const title = data.name || data.subtitle || `${data.unifiedMode ?? "Cursor"} session`;
    const model = modelFromConfig(data.modelConfig);
    const toolCallCount = countCursorToolCalls(data.fullConversationHeadersOnly);
    const messageCount = countCursorMessages(data.fullConversationHeadersOnly);
    const additions = data.totalLinesAdded ?? 0;
    const deletions = data.totalLinesRemoved ?? 0;
    const filesModified: FileChange[] =
      additions || deletions
        ? [{
            filePath: projectPath,
            additions,
            deletions,
            isNewFile: false,
          }]
        : [];
    const events: SessionEvent[] = [];
    if (data.subtitle) {
      events.push({ type: "assistant_response", timestamp: endedAt ?? startedAt, text: data.subtitle });
    }

    return {
      id,
      toolId: this.id,
      title,
      status: cursorStatus(data),
      projectPath,
      projectName: basename(projectPath || sourceFile),
      startedAt,
      endedAt,
      durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : 0,
      model,
      tokens: { used: 0, limit: 0 },
      estimatedCost: 0,
      messageCount,
      toolCallCount,
      filesModified,
      netLines: { additions, deletions },
      events,
      sourceFiles: [sourceFile],
      config: {
        model,
        tools: [],
        agent: data.unifiedMode,
      },
    };
  }

  override async discoverArtifacts(scope: Parameters<BasePlugin["discoverArtifacts"]>[0]) {
    const artifacts = await super.discoverArtifacts(scope);
    if (scope.level !== "user-home") return artifacts;

    const workspaceStorage = join(
      scope.basePath,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "workspaceStorage"
    );
    try {
      const workspaces = await readdir(workspaceStorage, { withFileTypes: true });
      for (const workspace of workspaces) {
        if (!workspace.isDirectory()) continue;
        const workspaceJson = join(workspaceStorage, workspace.name, "workspace.json");
        try {
          const s = await stat(workspaceJson);
          artifacts.push({
            path: workspaceJson,
            toolId: this.id,
            category: "memory",
            scope: scope.level,
            fileType: "json",
            size: s.size,
            lastModified: s.mtime,
          });
        } catch {
          // No workspace metadata
        }
      }
    } catch {
      // No workspace storage
    }

    return artifacts;
  }
}

function fromMillis(value: number | undefined): Date | undefined {
  if (typeof value !== "number") return undefined;
  return new Date(value);
}

function cursorStatus(data: CursorComposerData): Session["status"] {
  if (data.isArchived) return "archived";
  if (data.isDraft || data.status === "generating" || data.status === "running") return "active";
  return "done";
}

function modelFromConfig(config: Record<string, unknown> | undefined): string {
  if (!config) return "unknown";
  for (const key of ["model", "modelName", "selectedModel"]) {
    const value = config[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return "unknown";
}

function countCursorMessages(headers: CursorComposerData["fullConversationHeadersOnly"]): number {
  if (!Array.isArray(headers)) return 0;
  return headers.filter((header) => {
    const grouping = header.grouping ?? {};
    return grouping.hasText === true || grouping.hasThinking === true;
  }).length;
}

function countCursorToolCalls(headers: CursorComposerData["fullConversationHeadersOnly"]): number {
  if (!Array.isArray(headers)) return 0;
  return headers.filter((header) => header.grouping?.toolCallId).length;
}
