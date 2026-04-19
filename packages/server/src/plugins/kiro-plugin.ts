import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import type {
  ToolId,
  ArtifactCategory,
  Session,
  SessionEvent,
  FileChange,
} from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * Kiro plugin — discovers Kiro config, artifacts, and parses session data.
 */
export class KiroPlugin extends BasePlugin {
  readonly id: ToolId = "kiro";
  readonly displayName = "Kiro";
  readonly color = "#3a6b8a";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "steering",
    "hooks",
    "agents",
  ];
  readonly configDirNames = [".kiro"];
  readonly commandNames = ["kiro"];
  readonly systemPaths = ["/etc/kiro/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.yaml" },
    { relativePath: "config.yml" },
    { relativePath: "settings.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "specs", category: "steering", isDirectory: true },
    { relativePath: "steering", category: "steering", isDirectory: true },
    { relativePath: "hooks", category: "hooks", isDirectory: true },
    { relativePath: "skills", category: "agents", isDirectory: true },
  ];

  /** Parse sessions from Kiro's proprietary session format */
  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const sessionsDir = join(projectPath, ".kiro", "sessions");

    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = join(sessionsDir, entry.name);
        if (
          !entry.name.endsWith(".json") &&
          !entry.name.endsWith(".yaml") &&
          !entry.name.endsWith(".yml")
        ) {
          continue;
        }
        const session = await this.parseSessionFile(filePath);
        if (session) {
          sessions.push(session);
        }
      }
    } catch {
      // No sessions directory — return empty
    }

    return sessions;
  }

  /** Parse a single Kiro session file */
  override async parseSessionFile(filePath: string): Promise<Session | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      if (!content.trim()) return null;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(content);
      } catch {
        return null; // Can't parse — return null without throwing
      }

      const events: SessionEvent[] = [];
      const filesModified: FileChange[] = [];
      let messageCount = 0;
      let toolCallCount = 0;

      // Parse events array if present
      const rawEvents = (data.events ?? []) as Record<string, unknown>[];
      for (const evt of rawEvents) {
        const timestamp = evt.timestamp
          ? new Date(evt.timestamp as string)
          : new Date();
        const type = evt.type as string;

        if (type === "user_prompt") {
          messageCount++;
          events.push({
            type: "user_prompt",
            timestamp,
            text: (evt.text ?? "") as string,
          });
        } else if (type === "assistant_response") {
          messageCount++;
          events.push({
            type: "assistant_response",
            timestamp,
            text: (evt.text ?? "") as string,
          });
        } else if (type === "tool_call") {
          toolCallCount++;
          events.push({
            type: "tool_call",
            timestamp,
            toolName: (evt.toolName ?? "unknown") as string,
            input: String(evt.input ?? ""),
            output: evt.output ? String(evt.output) : undefined,
            success: (evt.success as boolean) ?? true,
          });
        } else if (type === "file_edit") {
          const fp = (evt.filePath ?? "") as string;
          const additions = (evt.additions ?? 0) as number;
          const deletions = (evt.deletions ?? 0) as number;
          const isNewFile = (evt.isNewFile ?? false) as boolean;
          filesModified.push({ filePath: fp, additions, deletions, isNewFile });
          events.push({
            type: "file_edit",
            timestamp,
            filePath: fp,
            additions,
            deletions,
            isNewFile,
            diff: evt.diff as string | undefined,
          });
        } else if (type === "error") {
          events.push({
            type: "error",
            timestamp,
            message: (evt.message ?? "Unknown error") as string,
            details: evt.details as string | undefined,
          });
        }
      }

      const startedAt = data.startedAt
        ? new Date(data.startedAt as string)
        : new Date();
      const endedAt = data.endedAt
        ? new Date(data.endedAt as string)
        : undefined;
      const durationMs = endedAt
        ? endedAt.getTime() - startedAt.getTime()
        : (data.durationMs as number) ?? 0;

      const netAdditions = filesModified.reduce((s, f) => s + f.additions, 0);
      const netDeletions = filesModified.reduce((s, f) => s + f.deletions, 0);
      const tokens = (data.tokens as number) ?? 0;

      return {
        id: (data.id as string) ?? this.generateSessionId(filePath),
        toolId: this.id,
        title: (data.title as string) ?? basename(filePath, ".json"),
        status: (data.status as Session["status"]) ?? "done",
        projectPath: dirname(dirname(dirname(filePath))),
        projectName: basename(dirname(dirname(dirname(filePath)))),
        startedAt,
        endedAt,
        durationMs,
        model: (data.model as string) ?? "unknown",
        tokens: { used: tokens, limit: (data.tokenLimit as number) ?? 0 },
        estimatedCost: (data.estimatedCost as number) ?? tokens * 0.000003,
        messageCount,
        toolCallCount,
        filesModified,
        netLines: { additions: netAdditions, deletions: netDeletions },
        events,
        sourceFiles: [filePath],
        config: {
          model: (data.model as string) ?? "unknown",
          tools: (data.tools as string[]) ?? [],
          systemPrompt: data.systemPrompt as string | undefined,
        },
      };
    } catch {
      return null;
    }
  }
}
