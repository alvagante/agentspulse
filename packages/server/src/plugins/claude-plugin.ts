import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
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
 *
 * Claude Code stores sessions in ~/.claude/projects/{encoded-path}/*.jsonl
 * where encoded-path replaces all `/` with `-`.
 *
 * JSONL entry types:
 * - type: "system" — sessionId, cwd, timestamp, version
 * - type: "user" — message.role: "user", message.content: [{type: "text", text}]
 * - type: "assistant" — message.role: "assistant", message.model, message.usage, message.content (may include tool_use blocks)
 * - type: "last-prompt" — lastPrompt, sessionId
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

  /**
   * Encode a project path to the Claude projects directory format.
   * Claude replaces all `/` with `-` in the absolute path.
   * e.g. /Users/al/Documents/GITHUB/myproject → -Users-al-Documents-GITHUB-myproject
   */
  encodeProjectPath(projectPath: string): string {
    return projectPath.replace(/\//g, "-");
  }

  /**
   * Parse sessions from Claude's JSONL session files.
   * Sessions live in ~/.claude/projects/{encoded-path}/*.jsonl
   */
  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const home = homedir();
    const encodedPath = this.encodeProjectPath(projectPath);
    const sessionsDir = join(home, ".claude", "projects", encodedPath);

    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        const filePath = join(sessionsDir, entry.name);
        const session = await this.parseSessionFile(filePath, projectPath);
        if (session) {
          sessions.push(session);
        }
      }
    } catch {
      // No sessions directory or can't read — return empty
    }

    return sessions;
  }

  /**
   * Parse a single Claude JSONL session file.
   * Optionally accepts a projectPath override (used when called from parseSessions).
   */
  override async parseSessionFile(filePath: string, projectPath?: string): Promise<Session | null> {
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
      let sessionId = "";
      let cwd = projectPath ?? "";
      let version = "";

      for (const line of lines) {
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        const type = entry.type as string | undefined;

        // Extract timestamp from various locations
        let timestamp: Date;
        if (entry.timestamp) {
          timestamp = new Date(typeof entry.timestamp === "number" ? entry.timestamp : entry.timestamp as string);
        } else {
          timestamp = new Date();
        }

        if (!startedAt || timestamp < startedAt) startedAt = timestamp;
        if (!endedAt || timestamp > endedAt) endedAt = timestamp;

        if (type === "system") {
          // System entry: sessionId, cwd, timestamp, version
          if (entry.sessionId) sessionId = entry.sessionId as string;
          if (entry.cwd) cwd = entry.cwd as string;
          if (entry.version) version = entry.version as string;
        } else if (type === "user") {
          // User message
          messageCount++;
          const message = entry.message as Record<string, unknown> | undefined;
          let text = "";
          if (message?.content) {
            const contentArr = message.content as Array<Record<string, unknown>>;
            if (Array.isArray(contentArr)) {
              for (const block of contentArr) {
                if (block.type === "text" && block.text) {
                  text += (block.text as string) + "\n";
                }
              }
            }
          }
          text = text.trim();
          if (!title && text) title = text.slice(0, 100);
          events.push({ type: "user_prompt", timestamp, text });
        } else if (type === "assistant") {
          // Assistant message — contains model, usage, and possibly tool_use blocks
          messageCount++;
          const message = entry.message as Record<string, unknown> | undefined;
          if (message) {
            if (message.model) model = message.model as string;

            // Extract token usage
            const usage = message.usage as Record<string, number> | undefined;
            if (usage) {
              const inputTokens = usage.input_tokens ?? 0;
              const outputTokens = usage.output_tokens ?? 0;
              totalTokens += inputTokens + outputTokens;
            }

            // Extract text and tool_use blocks from content
            let assistantText = "";
            const contentArr = message.content as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(contentArr)) {
              for (const block of contentArr) {
                if (block.type === "text" && block.text) {
                  assistantText += (block.text as string) + "\n";
                } else if (block.type === "tool_use") {
                  toolCallCount++;
                  const toolName = (block.name ?? "unknown") as string;
                  const input = block.input as Record<string, unknown> | undefined;
                  let inputStr = "";
                  if (input) {
                    // Try to extract a meaningful input string
                    inputStr = input.file_path as string
                      ?? input.command as string
                      ?? input.pattern as string
                      ?? JSON.stringify(input);
                  }
                  events.push({
                    type: "tool_call",
                    timestamp,
                    toolName,
                    input: inputStr,
                    output: undefined,
                    success: true,
                  });

                  // Track file modifications from Write/Edit tools
                  if ((toolName === "Write" || toolName === "Edit") && input?.file_path) {
                    const fp = input.file_path as string;
                    if (!filesModified.has(fp)) {
                      filesModified.set(fp, {
                        filePath: fp,
                        additions: 0,
                        deletions: 0,
                        isNewFile: toolName === "Write",
                      });
                    }
                  }
                }
              }
            }
            assistantText = assistantText.trim();
            events.push({ type: "assistant_response", timestamp, text: assistantText });
          }
        } else if (type === "last-prompt") {
          // Use lastPrompt as title if we don't have one yet
          const lastPrompt = entry.lastPrompt as string | undefined;
          if (lastPrompt && !title) {
            title = lastPrompt.slice(0, 100);
          }
        }
        // Skip other types: file-history-snapshot, attachment, etc.
      }

      if (!startedAt) return null;

      const resolvedProjectPath = cwd || projectPath || "";
      const fileChanges = Array.from(filesModified.values());
      const netAdditions = fileChanges.reduce((s, f) => s + f.additions, 0);
      const netDeletions = fileChanges.reduce((s, f) => s + f.deletions, 0);
      const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : 0;

      return {
        id: sessionId || this.generateSessionId(filePath),
        toolId: this.id,
        title: title || basename(filePath, ".jsonl"),
        status,
        projectPath: resolvedProjectPath,
        projectName: basename(resolvedProjectPath),
        startedAt,
        endedAt,
        durationMs,
        model,
        tokens: { used: totalTokens, limit: 0 },
        estimatedCost: totalTokens * 0.000003,
        messageCount,
        toolCallCount,
        filesModified: fileChanges,
        netLines: { additions: netAdditions, deletions: netDeletions },
        events,
        sourceFiles: [filePath],
        config: {
          model,
          tools: [],
          systemPrompt: undefined,
        },
      };
    } catch {
      return null;
    }
  }
}
