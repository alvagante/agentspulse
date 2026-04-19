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
 * Continue plugin — discovers Continue config, artifacts, and parses session data.
 *
 * Continue stores sessions in ~/.continue/sessions/*.json with format:
 * { sessionId, title, workspaceDirectory, history: [{message: {role, content: [{type, text}]}}] }
 */
export class ContinuePlugin extends BasePlugin {
  readonly id: ToolId = "continue";
  readonly displayName = "Continue";
  readonly color = "#8a3a6a";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "agents",
    "steering",
  ];
  readonly configDirNames = [".continue"];
  readonly commandNames = ["continue"];
  readonly systemPaths = ["/etc/continue/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.json" },
    { relativePath: "rules.md" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "prompts", category: "agents", isDirectory: true },
    { relativePath: "rules.md", category: "steering", isDirectory: false },
  ];

  /**
   * Parse sessions from Continue's JSON session files.
   * Sessions live in ~/.continue/sessions/*.json
   */
  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const home = homedir();
    const sessionsDir = join(home, ".continue", "sessions");

    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const filePath = join(sessionsDir, entry.name);
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

  /** Parse a single Continue JSON session file */
  override async parseSessionFile(filePath: string): Promise<Session | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      if (!content.trim()) return null;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(content);
      } catch {
        return null;
      }

      const sessionId = (data.sessionId ?? "") as string;
      const sessionTitle = (data.title ?? "") as string;
      const workspaceDirectory = (data.workspaceDirectory ?? "") as string;
      const history = (data.history ?? []) as Array<Record<string, unknown>>;

      const events: SessionEvent[] = [];
      let title = sessionTitle;
      let messageCount = 0;
      let toolCallCount = 0;
      let totalTokens = 0;
      let model = "unknown";
      const now = new Date();

      for (const historyEntry of history) {
        const message = historyEntry.message as Record<string, unknown> | undefined;
        if (!message) continue;

        const role = message.role as string | undefined;
        const contentArr = message.content as Array<Record<string, unknown>> | undefined;

        let text = "";
        if (Array.isArray(contentArr)) {
          for (const block of contentArr) {
            if (block.type === "text" && block.text) {
              text += (block.text as string) + "\n";
            }
          }
        } else if (typeof message.content === "string") {
          text = message.content as string;
        }
        text = text.trim();

        if (role === "user") {
          messageCount++;
          if (!title && text) title = text.slice(0, 100);
          events.push({ type: "user_prompt", timestamp: now, text });
        } else if (role === "assistant") {
          messageCount++;
          events.push({ type: "assistant_response", timestamp: now, text });

          // Check for tool calls in content
          if (Array.isArray(contentArr)) {
            for (const block of contentArr) {
              if (block.type === "tool_use") {
                toolCallCount++;
                events.push({
                  type: "tool_call",
                  timestamp: now,
                  toolName: (block.name ?? "unknown") as string,
                  input: block.input ? JSON.stringify(block.input) : "",
                  output: undefined,
                  success: true,
                });
              }
            }
          }
        }
      }

      return {
        id: sessionId || this.generateSessionId(filePath),
        toolId: this.id,
        title: title || basename(filePath, ".json"),
        status: "done",
        projectPath: workspaceDirectory,
        projectName: basename(workspaceDirectory || filePath),
        startedAt: now,
        endedAt: undefined,
        durationMs: 0,
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
