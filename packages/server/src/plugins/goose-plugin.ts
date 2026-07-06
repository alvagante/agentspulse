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

interface GooseSessionRow {
  id: string;
  name: string;
  description: string;
  working_dir: string;
  created_at: string;
  updated_at: string;
  total_tokens: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  accumulated_total_tokens: number | null;
  provider_name: string | null;
  model_config_json: string | null;
  goose_mode: string | null;
}

interface GooseMessageRow {
  session_id: string;
  role: string;
  content_json: string;
  created_timestamp: number;
  tokens: number | null;
  metadata_json: string | null;
}

/**
 * Goose plugin — discovers Goose config/artifacts and parses SQLite-backed sessions.
 *
 * Goose stores session metadata and messages in
 * ~/.local/share/goose/sessions/sessions.db.
 */
export class GoosePlugin extends BasePlugin {
  readonly id: ToolId = "goose";
  readonly displayName = "Goose";
  readonly color = "#4f7f4f";
  readonly artifactCategories: ArtifactCategory[] = ["config", "mcps", "memory"];
  readonly configDirNames = [".config/goose", ".local/share/goose"];
  readonly commandNames = ["goose"];
  readonly systemPaths = ["/etc/goose/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.yaml" },
    { relativePath: "projects.json" },
    { relativePath: "models/registry.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "custom_providers", category: "config", isDirectory: true },
    { relativePath: "mcp-apps-cache", category: "mcps", isDirectory: true },
    { relativePath: "apps", category: "agents", isDirectory: true },
  ];

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions = await this.readSessions();
    return sessions.filter((session) => session.projectPath === projectPath);
  }

  override async parseSessionFile(filePath: string): Promise<Session | null> {
    const sessions = await this.readSessions(filePath);
    return sessions[0] ?? null;
  }

  private async readSessions(
    dbPath = join(homedir(), ".local", "share", "goose", "sessions", "sessions.db")
  ): Promise<Session[]> {
    const rows = await querySqliteJson<GooseSessionRow>(
      dbPath,
      `select id, name, description, working_dir, created_at, updated_at,
              total_tokens, input_tokens, output_tokens, accumulated_total_tokens,
              provider_name, model_config_json, goose_mode
       from sessions`
    );
    if (rows.length === 0) return [];

    const messageRows = await querySqliteJson<GooseMessageRow>(
      dbPath,
      `select session_id, role, content_json, created_timestamp, tokens, metadata_json
       from messages
       order by created_timestamp, id`
    );
    const messagesBySession = new Map<string, GooseMessageRow[]>();
    for (const message of messageRows) {
      const messages = messagesBySession.get(message.session_id) ?? [];
      messages.push(message);
      messagesBySession.set(message.session_id, messages);
    }

    const dbStat = await this.statOptional(dbPath);
    return rows.map((row) =>
      this.toSession(row, messagesBySession.get(row.id) ?? [], dbPath, dbStat?.mtimeMs)
    );
  }

  private toSession(
    row: GooseSessionRow,
    messages: GooseMessageRow[],
    dbPath: string,
    dbMtimeMs?: number
  ): Session {
    const events: SessionEvent[] = [];
    let title = row.name || row.description;
    let messageCount = 0;
    let toolCallCount = 0;
    let totalMessageTokens = 0;

    for (const message of messages) {
      const timestamp = timestampFromGoose(message.created_timestamp);
      const text = extractGooseText(message.content_json);

      if (message.role === "user") {
        messageCount++;
        if (!title && text) title = text.slice(0, 100);
        events.push({ type: "user_prompt", timestamp, text });
      } else if (message.role === "assistant") {
        messageCount++;
        events.push({ type: "assistant_response", timestamp, text });
      }

      const toolCalls = extractGooseToolCalls(message.content_json, timestamp);
      toolCallCount += toolCalls.length;
      events.push(...toolCalls);
      totalMessageTokens += message.tokens ?? 0;
    }

    const startedAt = parseDate(row.created_at) ?? events[0]?.timestamp ?? new Date(0);
    const endedAt = parseDate(row.updated_at) ?? events.at(-1)?.timestamp;
    const tokenTotal =
      row.accumulated_total_tokens ?? row.total_tokens ?? totalMessageTokens;
    const modelConfig = parseJsonObject(row.model_config_json);
    const model =
      stringValue(modelConfig?.model_name) ??
      stringValue(modelConfig?.model) ??
      row.provider_name ??
      "unknown";
    const status =
      dbMtimeMs && Date.now() - dbMtimeMs < 2 * 60 * 1000 ? "active" : "done";

    return {
      id: row.id,
      toolId: this.id,
      title: title || row.id,
      status,
      projectPath: row.working_dir,
      projectName: basename(row.working_dir || dbPath),
      startedAt,
      endedAt,
      durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : 0,
      model,
      tokens: { used: tokenTotal ?? 0, limit: numberValue(modelConfig?.context_limit) ?? 0 },
      estimatedCost: (tokenTotal ?? 0) * 0.000003,
      messageCount,
      toolCallCount,
      filesModified: [],
      netLines: { additions: 0, deletions: 0 },
      events,
      sourceFiles: [dbPath],
      config: {
        model,
        maxTokens: numberValue(modelConfig?.max_tokens),
        tools: [],
        agent: row.goose_mode ?? undefined,
      },
    };
  }

  private async statOptional(path: string) {
    try {
      return await stat(path);
    } catch {
      return null;
    }
  }

  override async discoverArtifacts(scope: Parameters<BasePlugin["discoverArtifacts"]>[0]) {
    const artifacts = await super.discoverArtifacts(scope);

    if (scope.level !== "user-home") return artifacts;
    const stateDir = join(scope.basePath, ".local", "state", "goose", "logs");
    try {
      const entries = await readdir(stateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        const filePath = join(stateDir, entry.name);
        const s = await stat(filePath);
        artifacts.push({
          path: filePath,
          toolId: this.id,
          category: "logs",
          scope: scope.level,
          fileType: "json",
          size: s.size,
          lastModified: s.mtime,
        });
      }
    } catch {
      // No logs directory
    }

    return artifacts;
  }
}

function extractGooseText(contentJson: string): string {
  const content = parseJsonValue(contentJson);
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block as Record<string, unknown>;
    if (item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    }
  }
  return parts.join("\n").trim();
}

function extractGooseToolCalls(contentJson: string, timestamp: Date): SessionEvent[] {
  const content = parseJsonValue(contentJson);
  if (!Array.isArray(content)) return [];

  const events: SessionEvent[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block as Record<string, unknown>;
    if (item.type !== "toolRequest" && item.type !== "toolResponse") continue;

    const toolCall = item.toolCall as Record<string, unknown> | undefined;
    const toolName =
      stringValue(toolCall?.name) ??
      stringValue(item.name) ??
      (item.type === "toolResponse" ? "toolResponse" : "toolRequest");
    events.push({
      type: "tool_call",
      timestamp,
      toolName,
      input: toolCall?.arguments ? JSON.stringify(toolCall.arguments) : "",
      output: item.toolResult ? JSON.stringify(item.toolResult) : undefined,
      success: item.type !== "toolResponse" || item.isError !== true,
    });
  }
  return events;
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function parseDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function timestampFromGoose(value: number): Date {
  const millis = value > 10_000_000_000 ? value : value * 1000;
  return new Date(millis);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
