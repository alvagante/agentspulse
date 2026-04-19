import { readFile, readdir } from "node:fs/promises";
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

/**
 * Codex plugin — discovers Codex config, artifacts, and parses JSONL sessions.
 *
 * Codex stores sessions in ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 * First entry has type: "session_meta" with payload.cwd for project path.
 * Subsequent entries have type: "response_item" with payload.role and payload.content.
 */
export class CodexPlugin extends BasePlugin {
  readonly id: ToolId = "codex";
  readonly displayName = "Codex";
  readonly color = "#5a5a5a";
  readonly artifactCategories: ArtifactCategory[] = ["config", "steering"];
  readonly configDirNames = [".codex"];
  readonly commandNames = ["codex"];
  readonly systemPaths = ["/etc/codex/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.toml" },
    { relativePath: "instructions.md" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "instructions.md", category: "steering", isDirectory: false },
  ];

  /**
   * Parse sessions from Codex's JSONL session files.
   * Sessions live in ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
   * We need to walk the date-based directory structure.
   */
  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const home = homedir();
    const sessionsBaseDir = join(home, ".codex", "sessions");

    try {
      const sessionFiles = await this.findCodexSessionFiles(sessionsBaseDir);
      for (const filePath of sessionFiles) {
        const session = await this.parseSessionFile(filePath);
        if (session && session.projectPath === projectPath) {
          sessions.push(session);
        }
      }
    } catch {
      // No sessions directory or can't read
    }

    return sessions;
  }

  /** Recursively find all rollout-*.jsonl files under the sessions directory */
  private async findCodexSessionFiles(baseDir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const years = await readdir(baseDir, { withFileTypes: true });
      for (const year of years) {
        if (!year.isDirectory()) continue;
        const yearPath = join(baseDir, year.name);
        try {
          const months = await readdir(yearPath, { withFileTypes: true });
          for (const month of months) {
            if (!month.isDirectory()) continue;
            const monthPath = join(yearPath, month.name);
            try {
              const days = await readdir(monthPath, { withFileTypes: true });
              for (const day of days) {
                if (!day.isDirectory()) continue;
                const dayPath = join(monthPath, day.name);
                try {
                  const entries = await readdir(dayPath, { withFileTypes: true });
                  for (const entry of entries) {
                    if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
                      files.push(join(dayPath, entry.name));
                    }
                  }
                } catch { /* skip */ }
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return files;
  }

  /** Parse a single Codex JSONL session file */
  override async parseSessionFile(filePath: string): Promise<Session | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length === 0) return null;

      const events: SessionEvent[] = [];
      let title = "";
      let model = "unknown";
      let totalTokens = 0;
      let messageCount = 0;
      let toolCallCount = 0;
      let startedAt: Date | null = null;
      let endedAt: Date | undefined;
      let status: Session["status"] = "done";
      let sessionId = "";
      let cwd = "";
      let cliVersion = "";

      for (const line of lines) {
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        const type = entry.type as string | undefined;
        const timestamp = entry.timestamp
          ? new Date(entry.timestamp as string)
          : new Date();

        if (!startedAt || timestamp < startedAt) startedAt = timestamp;
        if (!endedAt || timestamp > endedAt) endedAt = timestamp;

        if (type === "session_meta") {
          const payload = entry.payload as Record<string, unknown> | undefined;
          if (payload) {
            sessionId = (payload.id ?? "") as string;
            cwd = (payload.cwd ?? "") as string;
            cliVersion = (payload.cli_version ?? "") as string;
            if (payload.model) model = payload.model as string;
          }
        } else if (type === "response_item") {
          const payload = entry.payload as Record<string, unknown> | undefined;
          if (payload) {
            const role = payload.role as string | undefined;
            const contentArr = payload.content as Array<Record<string, unknown>> | undefined;

            if (role === "user") {
              messageCount++;
              let text = "";
              if (Array.isArray(contentArr)) {
                for (const block of contentArr) {
                  if ((block.type === "input_text" || block.type === "text") && block.text) {
                    text += (block.text as string) + "\n";
                  }
                }
              }
              text = text.trim();
              if (!title && text) title = text.slice(0, 100);
              events.push({ type: "user_prompt", timestamp, text });
            } else if (role === "assistant") {
              messageCount++;
              let text = "";
              if (Array.isArray(contentArr)) {
                for (const block of contentArr) {
                  if (block.type === "text" && block.text) {
                    text += (block.text as string) + "\n";
                  } else if (block.type === "tool_use") {
                    toolCallCount++;
                    const toolName = (block.name ?? "unknown") as string;
                    const input = block.input as Record<string, unknown> | undefined;
                    events.push({
                      type: "tool_call",
                      timestamp,
                      toolName,
                      input: input ? JSON.stringify(input) : "",
                      output: undefined,
                      success: true,
                    });
                  }
                }
              }
              text = text.trim();
              events.push({ type: "assistant_response", timestamp, text });
            }

            // Extract token usage if present
            if (payload.usage) {
              const usage = payload.usage as Record<string, number>;
              totalTokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
            }
            if (payload.model) model = payload.model as string;
          }
        }
      }

      if (!startedAt) return null;

      const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : 0;

      return {
        id: sessionId || this.generateSessionId(filePath),
        toolId: this.id,
        title: title || basename(filePath, ".jsonl"),
        status,
        projectPath: cwd,
        projectName: basename(cwd || filePath),
        startedAt,
        endedAt,
        durationMs,
        model,
        tokens: { used: totalTokens, limit: 0 },
        estimatedCost: totalTokens * 0.000003,
        messageCount,
        toolCallCount,
        filesModified: [],
        netLines: { additions: 0, deletions: 0 },
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
