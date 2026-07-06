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

/**
 * Gemini CLI plugin — discovers Gemini config, artifacts, and parses JSONL sessions.
 *
 * Gemini stores sessions in ~/.gemini/tmp/<project-slug>/chats/session-*.jsonl
 * Project-to-slug mapping is in ~/.gemini/projects.json
 *
 * JSONL line types:
 * - metadata (first line): { sessionId, projectHash, model, startTime, lastUpdated, kind }
 * - user message:    { id, timestamp, type:"user", content:[{text}] }
 * - gemini response: { id, timestamp, type:"gemini", content:string, thoughts, tokens, model, toolCalls? }
 * - info/error:      { id, timestamp, type:"info"|"error", content:string }
 * - metadata update: { $set: { displayName, summary, messageCount, lastUpdated } }
 * - rewind:          { $rewindTo: "<message-id>" }
 */
export class GeminiPlugin extends BasePlugin {
  readonly id: ToolId = "gemini";
  readonly displayName = "Gemini";
  readonly color = "#6a5a8a";
  readonly artifactCategories: ArtifactCategory[] = ["config", "steering", "memory"];
  readonly configDirNames = [".gemini"];
  readonly commandNames = ["gemini"];
  readonly systemPaths = ["/etc/gemini/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
    { relativePath: "GEMINI.md" },
    { relativePath: "projects.json" },
    { relativePath: "trustedFolders.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "GEMINI.md", category: "steering", isDirectory: false },
    { relativePath: "memory.md", category: "memory", isDirectory: false },
  ];

  /** Resolve the Gemini project slug for a given absolute project path. */
  private async resolveProjectSlug(projectPath: string): Promise<string | null> {
    const home = homedir();

    // Primary: look up in ~/.gemini/projects.json
    const projectsJsonPath = join(home, ".gemini", "projects.json");
    try {
      const content = await readFile(projectsJsonPath, "utf-8");
      const data = JSON.parse(content) as { projects?: Record<string, string> };
      if (data.projects?.[projectPath]) {
        return data.projects[projectPath];
      }
    } catch {
      // projects.json missing or unreadable
    }

    // Fallback: scan ~/.gemini/tmp/*/. project_root files
    const tmpDir = join(home, ".gemini", "tmp");
    try {
      const entries = await readdir(tmpDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const rootFile = join(tmpDir, entry.name, ".project_root");
        try {
          const rootContent = (await readFile(rootFile, "utf-8")).trim();
          if (rootContent === projectPath) return entry.name;
        } catch {
          // No .project_root here
        }
      }
    } catch {
      // No tmp directory
    }

    return null;
  }

  override async parseSessions(projectPath: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const home = homedir();
    const slug = await this.resolveProjectSlug(projectPath);
    if (!slug) return sessions;

    const chatsDir = join(home, ".gemini", "tmp", slug, "chats");
    try {
      const entries = await readdir(chatsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        const session = await this.parseSessionFile(
          join(chatsDir, entry.name),
          projectPath
        );
        if (session) sessions.push(session);
      }
    } catch {
      // No chats directory or unreadable
    }

    return sessions;
  }

  override async parseSessionFile(
    filePath: string,
    projectPath?: string
  ): Promise<Session | null> {
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
      const resolvedProjectPath = projectPath ?? "";

      for (const line of lines) {
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        // Metadata update record
        if (entry.$set) {
          const set = entry.$set as Record<string, unknown>;
          if (set.displayName && !title) {
            title = (set.displayName as string).slice(0, 100);
          }
          if (set.lastUpdated) {
            const d = new Date(set.lastUpdated as string);
            if (!endedAt || d > endedAt) endedAt = d;
          }
          continue;
        }

        // Skip rewind records
        if (entry.$rewindTo) continue;

        // First-line metadata record (no type field)
        if (entry.sessionId && !entry.type) {
          sessionId = entry.sessionId as string;
          if (entry.model) model = entry.model as string;
          if (entry.startTime && !startedAt) {
            startedAt = new Date(entry.startTime as string);
          }
          continue;
        }

        // Message records
        const type = entry.type as string | undefined;
        if (!type) continue;

        const timestamp = entry.timestamp
          ? new Date(entry.timestamp as string)
          : new Date();

        if (!startedAt || timestamp < startedAt) startedAt = timestamp;
        if (!endedAt || timestamp > endedAt) endedAt = timestamp;

        if (type === "user") {
          messageCount++;
          let text = "";
          const c = entry.content;
          if (Array.isArray(c)) {
            for (const block of c as Array<Record<string, unknown>>) {
              if (block.text) text += (block.text as string) + "\n";
            }
          } else if (typeof c === "string") {
            text = c;
          }
          text = text.trim();
          if (!title && text) title = text.slice(0, 100);
          events.push({ type: "user_prompt", timestamp, text });
        } else if (type === "gemini") {
          messageCount++;
          const text =
            typeof entry.content === "string" ? entry.content : "";
          if (entry.model) model = entry.model as string;

          // Token accounting: { input, output, cached, thoughts, tool, total }
          const tokens = entry.tokens as Record<string, number> | undefined;
          if (tokens) {
            totalTokens += (tokens.input ?? 0) + (tokens.output ?? 0);
          }

          // Tool calls embedded in the gemini message
          const toolCalls = entry.toolCalls as
            | Array<Record<string, unknown>>
            | undefined;
          if (Array.isArray(toolCalls)) {
            for (const tc of toolCalls) {
              toolCallCount++;
              events.push({
                type: "tool_call",
                timestamp,
                toolName: (tc.name as string) ?? "unknown",
                input: tc.args ? JSON.stringify(tc.args) : "",
                output: tc.result ? JSON.stringify(tc.result) : undefined,
                success: tc.status !== "error",
              });
            }
          }

          events.push({ type: "assistant_response", timestamp, text });
        } else if (type === "error") {
          const msg =
            typeof entry.content === "string"
              ? entry.content
              : JSON.stringify(entry.content);
          events.push({ type: "error", timestamp, message: msg });
        }
        // "info" type (update notifications) — skip
      }

      if (!startedAt) return null;

      // Active if file was modified within the last 2 minutes
      try {
        const fileStat = await stat(filePath);
        if (Date.now() - fileStat.mtimeMs < 2 * 60 * 1000) status = "active";
      } catch {
        // Can't stat
      }

      const durationMs = endedAt
        ? endedAt.getTime() - startedAt.getTime()
        : 0;
      const projectName = resolvedProjectPath
        ? basename(resolvedProjectPath)
        : basename(filePath, ".jsonl");

      return {
        id: sessionId || this.generateSessionId(filePath),
        toolId: this.id,
        title: title || basename(filePath, ".jsonl"),
        status,
        projectPath: resolvedProjectPath,
        projectName,
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
        config: { model, tools: [], systemPrompt: undefined },
      };
    } catch {
      return null;
    }
  }
}
