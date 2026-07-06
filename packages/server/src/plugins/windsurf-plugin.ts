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

interface WindsurfKvRow {
  key: string;
  value: string | null;
}

interface WindsurfConversation {
  composerId?: string;
  conversationId?: string;
  id?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  createdAt?: number;
  updatedAt?: number;
  lastUpdatedAt?: number;
  status?: string;
  isDraft?: boolean;
  isArchived?: boolean;
  mode?: string;
  unifiedMode?: string;
  modelConfig?: Record<string, unknown>;
  workspaceIdentifier?: {
    uri?: {
      fsPath?: string;
      path?: string;
    };
  };
  fullConversationHeadersOnly?: Array<{
    grouping?: Record<string, unknown>;
  }>;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
}

/**
 * Windsurf plugin — discovers Windsurf config and VS Code-style state.
 */
export class WindsurfPlugin extends BasePlugin {
  readonly id: ToolId = "windsurf";
  readonly displayName = "Windsurf";
  readonly color = "#00a6a6";
  readonly artifactCategories: ArtifactCategory[] = ["config", "agents", "memory"];
  readonly configDirNames = [
    ".codeium/windsurf",
    ".windsurf",
    "Library/Application Support/Windsurf/User",
  ];
  readonly commandNames = ["windsurf"];
  readonly systemPaths = ["/etc/windsurf/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
    { relativePath: "keybindings.json" },
    { relativePath: "globalStorage/storage.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "rules", category: "steering", isDirectory: true },
    { relativePath: "memories", category: "memory", isDirectory: true },
    { relativePath: "workspaceStorage", category: "memory", isDirectory: true },
  ];

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions = await this.readConversations();
    return sessions.filter((session) => session.projectPath === projectPath);
  }

  override async parseSessionFile(filePath: string): Promise<Session | null> {
    if (!filePath.endsWith(".json")) return null;
    try {
      const data = JSON.parse(await readFile(filePath, "utf-8")) as WindsurfConversation;
      return this.toSession(data, filePath);
    } catch {
      return null;
    }
  }

  override async discoverArtifacts(scope: Parameters<BasePlugin["discoverArtifacts"]>[0]) {
    const artifacts = await super.discoverArtifacts(scope);
    if (scope.level !== "user-home") return artifacts;

    for (const root of windsurfUserDirs(scope.basePath)) {
      const workspaceStorage = join(root, "workspaceStorage");
      try {
        const entries = await readdir(workspaceStorage, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const workspaceJson = join(workspaceStorage, entry.name, "workspace.json");
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
        // No workspace storage at this root
      }
    }

    return artifacts;
  }

  private async readConversations(): Promise<Session[]> {
    const sessions: Session[] = [];
    for (const root of windsurfUserDirs(homedir())) {
      const stateDb = join(root, "globalStorage", "state.vscdb");
      try {
        const rows = await querySqliteJson<WindsurfKvRow>(
          stateDb,
          `select key, cast(value as text) as value
           from ItemTable
           where key in ('composer.composerHeaders', 'chat.workspaceState', 'aiService.prompts')
              or key like 'composerData:%'
              or key like 'conversation:%'
           union all
           select key, cast(value as text) as value
           from cursorDiskKV
           where key like 'composerData:%'
              or key like 'conversation:%'`
        );
        sessions.push(...this.rowsToSessions(rows, stateDb));
      } catch {
        // No readable Windsurf state DB
      }
    }
    return sessions;
  }

  private rowsToSessions(rows: WindsurfKvRow[], sourceFile: string): Session[] {
    const conversations = new Map<string, WindsurfConversation>();

    for (const row of rows) {
      if (!row.value) continue;
      const parsed = parseJsonObject(row.value);
      if (!parsed) continue;

      if (row.key === "composer.composerHeaders" && Array.isArray(parsed.allComposers)) {
        for (const item of parsed.allComposers as WindsurfConversation[]) {
          const id = conversationId(item);
          if (id) conversations.set(id, item);
        }
        continue;
      }

      if (row.key.startsWith("composerData:") || row.key.startsWith("conversation:")) {
        const item = parsed as WindsurfConversation;
        const id = conversationId(item) ?? row.key.split(":").slice(1).join(":");
        if (id) conversations.set(id, { ...conversations.get(id), ...item });
      }
    }

    return Array.from(conversations.values())
      .map((conversation) => this.toSession(conversation, sourceFile))
      .filter((session) => session.projectPath !== "");
  }

  private toSession(data: WindsurfConversation, sourceFile: string): Session {
    const id = conversationId(data) || this.generateSessionId(sourceFile);
    const startedAt = fromMillis(data.createdAt) ?? new Date(0);
    const endedAt = fromMillis(data.updatedAt ?? data.lastUpdatedAt);
    const projectPath =
      data.workspaceIdentifier?.uri?.fsPath ??
      data.workspaceIdentifier?.uri?.path ??
      "";
    const title = data.title || data.name || data.subtitle || "Windsurf session";
    const model = modelFromConfig(data.modelConfig);
    const additions = data.totalLinesAdded ?? 0;
    const deletions = data.totalLinesRemoved ?? 0;
    const filesModified: FileChange[] =
      additions || deletions
        ? [{ filePath: projectPath, additions, deletions, isNewFile: false }]
        : [];
    const events: SessionEvent[] = data.subtitle
      ? [{ type: "assistant_response", timestamp: endedAt ?? startedAt, text: data.subtitle }]
      : [];

    return {
      id,
      toolId: this.id,
      title,
      status: statusFromConversation(data),
      projectPath,
      projectName: basename(projectPath || sourceFile),
      startedAt,
      endedAt,
      durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : 0,
      model,
      tokens: { used: 0, limit: 0 },
      estimatedCost: 0,
      messageCount: countMessages(data.fullConversationHeadersOnly),
      toolCallCount: countToolCalls(data.fullConversationHeadersOnly),
      filesModified,
      netLines: { additions, deletions },
      events,
      sourceFiles: [sourceFile],
      config: { model, tools: [], agent: data.unifiedMode ?? data.mode },
    };
  }
}

export function windsurfUserDirs(home: string): string[] {
  return [
    join(home, "Library", "Application Support", "Windsurf", "User"),
    join(home, ".codeium", "windsurf"),
    join(home, ".windsurf"),
  ];
}

function conversationId(data: WindsurfConversation): string | undefined {
  return data.composerId ?? data.conversationId ?? data.id;
}

function fromMillis(value: number | undefined): Date | undefined {
  if (typeof value !== "number") return undefined;
  return new Date(value);
}

function statusFromConversation(data: WindsurfConversation): Session["status"] {
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

function countMessages(headers: WindsurfConversation["fullConversationHeadersOnly"]): number {
  if (!Array.isArray(headers)) return 0;
  return headers.filter((header) => {
    const grouping = header.grouping ?? {};
    return grouping.hasText === true || grouping.hasThinking === true;
  }).length;
}

function countToolCalls(headers: WindsurfConversation["fullConversationHeadersOnly"]): number {
  if (!Array.isArray(headers)) return 0;
  return headers.filter((header) => header.grouping?.toolCallId).length;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
