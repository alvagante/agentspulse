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
 * Claude Code plugin — discovers Claude config, artifacts, and parses JSONL sessions.
 */
export class ClaudePlugin extends BasePlugin {
  readonly id: ToolId = "claude";
  readonly displayName = "Claude Code";
  readonly color = "#b8693a";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "agents",
    "steering",
    "mcps",
  ];
  readonly configDirNames = [".claude"];
  readonly commandNames = ["claude"];
  readonly systemPaths = ["/etc/claude/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
    { relativePath: "CLAUDE.md" },
    { relativePath: "mcp.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "agents", category: "agents", isDirectory: true },
    { relativePath: "CLAUDE.md", category: "steering", isDirectory: false },
  ];

  /** Parse sessions from Claude's JSONL session files */
  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const sessionsDir = join(projectPath, ".claude", "sessions");

    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = join(sessionsDir, entry.name);
        if (!entry.name.endsWith(".jsonl") && !entry.name.endsWith(".json")) {
          continue;
        }
        const session = await this.parseSessionFile(filePath);
        if (session) {
          sessions.push(session);
        }
      }
    } catch {
      // No sessions directory or can't read — return empty
    }

    return sessions;
  }

  /** Parse a single JSONL session file, extract Session fields */
  override async parseSessionFile(filePath: string): Promise<Session | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length === 0) return null;

      const events: SessionEvent[] = [];
      const filesModified = new Map<string, FileChange>();
      let title = "";
      let model = "unknown";
      let totalTokens = 0;
      let messageCount = 0;
      let toolCallCount = 0;
      let startedAt: Date | null = null;
      let endedAt: Date | undefined;
      let status: Session["status"] = "done";

      for (const line of lines) {
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line);
        } catch {
          continue; // Skip malformed lines
        }

        const timestamp = entry.timestamp
          ? new Date(entry.timestamp as string)
          : new Date();

        if (!startedAt || timestamp < startedAt) startedAt = timestamp;
        if (!endedAt || timestamp > endedAt) endedAt = timestamp;

        const type = entry.type as string | undefined;

        if (type === "user_prompt" || type === "human") {
          const text = (entry.text ?? entry.content ?? "") as string;
          if (!title && text) title = text.slice(0, 100);
          messageCount++;
          events.push({ type: "user_prompt", timestamp, text });
        } else if (type === "assistant_response" || type === "assistant") {
          const text = (entry.text ?? entry.content ?? "") as string;
          messageCount++;
          events.push({ type: "assistant_response", timestamp, text });
        } else if (type === "tool_call" || type === "tool_use") {
          toolCallCount++;
          const toolName = (entry.tool ?? entry.name ?? "unknown") as string;
          const input = (entry.input ?? "") as string;
          const output = (entry.output ?? undefined) as string | undefined;
          events.push({
            type: "tool_call",
            timestamp,
            toolName,
            input: typeof input === "string" ? input : JSON.stringify(input),
            output: output ? (typeof output === "string" ? output : JSON.stringify(output)) : undefined,
            success: (entry.success as boolean) ?? true,
          });
        } else if (type === "file_edit") {
          const fp = (entry.filePath ?? entry.file ?? "") as string;
          const additions = (entry.additions ?? 0) as number;
          const deletions = (entry.deletions ?? 0) as number;
          const isNewFile = (entry.isNewFile ?? false) as boolean;
          const existing = filesModified.get(fp);
          if (existing) {
            existing.additions += additions;
            existing.deletions += deletions;
          } else {
            filesModified.set(fp, { filePath: fp, additions, deletions, isNewFile });
          }
          events.push({
            type: "file_edit",
            timestamp,
            filePath: fp,
            additions,
            deletions,
            isNewFile,
            diff: entry.diff as string | undefined,
          });
        } else if (type === "error") {
          events.push({
            type: "error",
            timestamp,
            message: (entry.message ?? "Unknown error") as string,
            details: entry.details as string | undefined,
          });
          status = "error";
        }

        if (entry.model) model = entry.model as string;
        if (entry.tokens) {
          totalTokens += typeof entry.tokens === "number"
            ? (entry.tokens as number)
            : 0;
        }
      }

      if (!startedAt) return null;

      const fileChanges = Array.from(filesModified.values());
      const netAdditions = fileChanges.reduce((s, f) => s + f.additions, 0);
      const netDeletions = fileChanges.reduce((s, f) => s + f.deletions, 0);
      const durationMs = endedAt
        ? endedAt.getTime() - startedAt.getTime()
        : 0;

      return {
        id: this.generateSessionId(filePath),
        toolId: this.id,
        title: title || basename(filePath, ".jsonl"),
        status,
        projectPath: dirname(dirname(dirname(filePath))), // up from .claude/sessions/file
        projectName: basename(dirname(dirname(dirname(filePath)))),
        startedAt,
        endedAt,
        durationMs,
        model,
        tokens: { used: totalTokens, limit: 0 },
        estimatedCost: totalTokens * 0.000003, // rough estimate
        messageCount,
        toolCallCount,
        filesModified: fileChanges,
        netLines: { additions: netAdditions, deletions: netDeletions },
        events,
        sourceFiles: [filePath],
        config: { model, tools: [], systemPrompt: undefined },
      };
    } catch {
      return null;
    }
  }
}
