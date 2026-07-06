import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type {
  ToolId,
  ArtifactCategory,
  Session,
  SessionEvent,
} from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

interface DevinSessionData {
  id?: string;
  sessionId?: string;
  title?: string;
  summary?: string;
  projectPath?: string;
  workspaceDirectory?: string;
  workingDirectory?: string;
  cwd?: string;
  repoPath?: string;
  createdAt?: string | number;
  startedAt?: string | number;
  updatedAt?: string | number;
  endedAt?: string | number;
  status?: string;
  model?: string;
  messages?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
}

/**
 * Devin plugin — discovers local Devin config and normalizes JSON/JSONL sessions.
 */
export class DevinPlugin extends BasePlugin {
  readonly id: ToolId = "devin";
  readonly displayName = "Devin";
  readonly color = "#4f46e5";
  readonly artifactCategories: ArtifactCategory[] = ["config", "agents", "memory"];
  readonly configDirNames = [".devin", "Library/Application Support/Devin"];
  readonly commandNames = ["devin"];
  readonly systemPaths = ["/etc/devin/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.json" },
    { relativePath: "settings.json" },
    { relativePath: "config.yaml" },
    { relativePath: "config.yml" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "agents", category: "agents", isDirectory: true },
    { relativePath: "memory", category: "memory", isDirectory: true },
    { relativePath: "sessions", category: "memory", isDirectory: true },
  ];

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    for (const filePath of await this.findSessionFiles()) {
      const session = await this.parseSessionFile(filePath);
      if (session?.projectPath === projectPath) sessions.push(session);
    }
    return sessions;
  }

  override async parseSessionFile(filePath: string): Promise<Session | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      if (!content.trim()) return null;

      const data = filePath.endsWith(".jsonl")
        ? parseJsonlSession(content)
        : (JSON.parse(content) as DevinSessionData);
      return this.toSession(data, filePath);
    } catch {
      return null;
    }
  }

  private async findSessionFiles(): Promise<string[]> {
    const roots = [
      join(homedir(), ".devin", "sessions"),
      join(homedir(), ".devin", "history"),
      join(homedir(), "Library", "Application Support", "Devin", "sessions"),
    ];
    const files: string[] = [];
    for (const root of roots) {
      files.push(...await this.walkSessionDir(root));
    }
    return files;
  }

  private async walkSessionDir(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.walkSessionDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl"))) {
          files.push(fullPath);
        }
      }
    } catch {
      // No Devin session directory
    }
    return files;
  }

  private async fileStatus(filePath: string): Promise<Session["status"]> {
    try {
      const s = await stat(filePath);
      return Date.now() - s.mtimeMs < 2 * 60 * 1000 ? "active" : "done";
    } catch {
      return "done";
    }
  }

  private async toSession(data: DevinSessionData, filePath: string): Promise<Session> {
    const sourceEvents = data.messages ?? data.events ?? [];
    const events = normalizeEvents(sourceEvents);
    const startedAt =
      parseDate(data.startedAt) ??
      parseDate(data.createdAt) ??
      events[0]?.timestamp ??
      new Date(0);
    const endedAt =
      parseDate(data.endedAt) ??
      parseDate(data.updatedAt) ??
      events.at(-1)?.timestamp;
    const projectPath =
      data.projectPath ??
      data.workspaceDirectory ??
      data.workingDirectory ??
      data.cwd ??
      data.repoPath ??
      "";
    const status = normalizeStatus(data.status) ?? await this.fileStatus(filePath);

    return {
      id: data.id ?? data.sessionId ?? this.generateSessionId(filePath),
      toolId: this.id,
      title: data.title ?? data.summary ?? firstUserPrompt(events) ?? basename(filePath),
      status,
      projectPath,
      projectName: basename(projectPath || filePath),
      startedAt,
      endedAt,
      durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : 0,
      model: data.model ?? "unknown",
      tokens: { used: 0, limit: 0 },
      estimatedCost: 0,
      messageCount: events.filter((event) => event.type === "user_prompt" || event.type === "assistant_response").length,
      toolCallCount: events.filter((event) => event.type === "tool_call").length,
      filesModified: [],
      netLines: { additions: 0, deletions: 0 },
      events,
      sourceFiles: [filePath],
      config: { model: data.model ?? "unknown", tools: [] },
    };
  }
}

function parseJsonlSession(content: string): DevinSessionData {
  const events: Array<Record<string, unknown>> = [];
  let metadata: DevinSessionData = {};

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (entry.type === "session" || entry.type === "metadata") {
        metadata = { ...metadata, ...entry };
      } else {
        events.push(entry);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return { ...metadata, events };
}

function normalizeEvents(items: Array<Record<string, unknown>>): SessionEvent[] {
  const events: SessionEvent[] = [];

  for (const item of items) {
    const role = stringValue(item.role) ?? stringValue(item.type);
    const timestamp = parseDate(item.timestamp) ?? parseDate(item.createdAt) ?? new Date();
    const text = extractText(item);

    if (role === "user") {
      events.push({ type: "user_prompt", timestamp, text });
    } else if (role === "assistant" || role === "devin") {
      events.push({ type: "assistant_response", timestamp, text });
    } else if (role === "tool" || role === "tool_call") {
      events.push({
        type: "tool_call",
        timestamp,
        toolName: stringValue(item.name) ?? stringValue(item.toolName) ?? "tool",
        input: stringifyUnknown(item.input ?? item.args ?? item.arguments),
        output: item.output ? stringifyUnknown(item.output) : undefined,
        success: item.success !== false,
      });
    } else if (role === "error") {
      events.push({ type: "error", timestamp, message: text || stringifyUnknown(item) });
    }
  }

  return events;
}

function extractText(item: Record<string, unknown>): string {
  const content = item.content ?? item.text ?? item.message;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        block && typeof block === "object"
          ? stringValue((block as Record<string, unknown>).text)
          : undefined
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function normalizeStatus(value: string | undefined): Session["status"] | undefined {
  if (value === "active" || value === "done" || value === "error" || value === "archived") {
    return value;
  }
  if (value === "running") return "active";
  if (value === "failed") return "error";
  if (value === "completed" || value === "complete") return "done";
  return undefined;
}

function firstUserPrompt(events: SessionEvent[]): string | undefined {
  const event = events.find((item) => item.type === "user_prompt");
  return event?.type === "user_prompt" ? event.text.slice(0, 100) : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value);
}
