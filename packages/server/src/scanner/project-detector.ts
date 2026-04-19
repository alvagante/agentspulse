import { execSync } from "node:child_process";
import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type {
  Project,
  ToolId,
  GitInfo,
  Dependency,
  ToolArtifact,
} from "../types.js";
import type { PluginRegistry } from "../plugins/plugin-registry.js";
import { TOOL_MARKERS } from "../constants.js";

/**
 * Identifies project directories and extracts metadata.
 */
export class ProjectDetector {
  constructor(private registry: PluginRegistry) {}

  /**
   * Scan root directories (1 level deep) for projects.
   * Each child directory is checked for tool marker subdirs.
   */
  async detectProjects(roots: string[]): Promise<Project[]> {
    const projects: Project[] = [];

    for (const root of roots) {
      try {
        const entries = await readdir(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirPath = join(root, entry.name);
          try {
            const tools = await this.detectTools(dirPath);
            if (tools.length > 0) {
              const project = await this.buildProject(dirPath, tools);
              projects.push(project);
            }
          } catch {
            // Skip directories we can't read
          }
        }
      } catch {
        // Skip roots we can't read
      }
    }

    return projects;
  }

  /**
   * Discover projects from tool session data directories.
   * Scans:
   * - ~/.claude/projects/ directory names (decode encoded paths)
   * - ~/.codex/sessions/ JSONL files for session_meta.payload.cwd
   * - ~/.continue/sessions/ JSON files for workspaceDirectory
   *
   * Returns deduplicated projects that exist on disk.
   */
  async detectProjectsFromToolData(): Promise<Project[]> {
    const discoveredPaths = new Set<string>();
    const home = homedir();

    // 1. Discover from ~/.claude/projects/ directory names
    await this.discoverClaudeProjects(home, discoveredPaths);

    // 2. Discover from ~/.codex/sessions/ JSONL files
    await this.discoverCodexProjects(home, discoveredPaths);

    // 3. Discover from ~/.continue/sessions/ JSON files
    await this.discoverContinueProjects(home, discoveredPaths);

    // Build Project objects for paths that exist on disk
    const projects: Project[] = [];
    for (const dirPath of discoveredPaths) {
      try {
        await access(dirPath);
        const s = await stat(dirPath);
        if (!s.isDirectory()) continue;
        const tools = await this.detectTools(dirPath);
        const project = await this.buildProject(dirPath, tools);
        projects.push(project);
      } catch {
        // Directory doesn't exist or can't access — skip
      }
    }

    return projects;
  }

  /**
   * Decode a Claude encoded project path back to a real filesystem path.
   * Claude encodes paths by replacing all `/` with `-`.
   * The encoded path starts with `-` (from the leading `/`).
   * e.g. -Users-al-Documents-GITHUB-myproject → /Users/al/Documents/GITHUB/myproject
   */
  decodeClaudeProjectPath(encoded: string): string {
    // The encoded path starts with `-` which represents the leading `/`
    // Replace all `-` with `/`
    return encoded.replace(/-/g, "/");
  }

  /** Discover project paths from ~/.claude/projects/ directory names */
  private async discoverClaudeProjects(home: string, paths: Set<string>): Promise<void> {
    const projectsDir = join(home, ".claude", "projects");
    try {
      const entries = await readdir(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const decoded = this.decodeClaudeProjectPath(entry.name);
        if (decoded && decoded !== "/") {
          paths.add(decoded);
        }
      }
    } catch {
      // No projects directory
    }
  }

  /** Discover project paths from ~/.codex/sessions/ JSONL files (session_meta.payload.cwd) */
  private async discoverCodexProjects(home: string, paths: Set<string>): Promise<void> {
    const sessionsDir = join(home, ".codex", "sessions");
    try {
      // Walk YYYY/MM/DD structure
      const years = await readdir(sessionsDir, { withFileTypes: true });
      for (const year of years) {
        if (!year.isDirectory()) continue;
        try {
          const months = await readdir(join(sessionsDir, year.name), { withFileTypes: true });
          for (const month of months) {
            if (!month.isDirectory()) continue;
            try {
              const days = await readdir(join(sessionsDir, year.name, month.name), { withFileTypes: true });
              for (const day of days) {
                if (!day.isDirectory()) continue;
                try {
                  const files = await readdir(join(sessionsDir, year.name, month.name, day.name), { withFileTypes: true });
                  for (const file of files) {
                    if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
                    const filePath = join(sessionsDir, year.name, month.name, day.name, file.name);
                    await this.extractCwdFromCodexFile(filePath, paths);
                  }
                } catch { /* skip */ }
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    } catch {
      // No sessions directory
    }
  }

  /** Extract cwd from the first line of a Codex session file */
  private async extractCwdFromCodexFile(filePath: string, paths: Set<string>): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      // Only read the first line for session_meta
      const firstLine = content.split("\n")[0];
      if (!firstLine) return;
      const entry = JSON.parse(firstLine) as Record<string, unknown>;
      if (entry.type === "session_meta") {
        const payload = entry.payload as Record<string, unknown> | undefined;
        if (payload?.cwd && typeof payload.cwd === "string") {
          paths.add(payload.cwd);
        }
      }
    } catch {
      // Can't read or parse
    }
  }

  /** Discover project paths from ~/.continue/sessions/ JSON files (workspaceDirectory) */
  private async discoverContinueProjects(home: string, paths: Set<string>): Promise<void> {
    const sessionsDir = join(home, ".continue", "sessions");
    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const filePath = join(sessionsDir, entry.name);
        try {
          const content = await readFile(filePath, "utf-8");
          const data = JSON.parse(content) as Record<string, unknown>;
          if (data.workspaceDirectory && typeof data.workspaceDirectory === "string" && data.workspaceDirectory !== "") {
            paths.add(data.workspaceDirectory);
          }
        } catch {
          // Can't read or parse
        }
      }
    } catch {
      // No sessions directory
    }
  }

  /** Check if a single directory is a project (has at least one tool marker) */
  async isProject(dirPath: string): Promise<boolean> {
    const tools = await this.detectTools(dirPath);
    return tools.length > 0;
  }

  /** Extract git metadata from a project */
  async extractGitInfo(projectPath: string): Promise<GitInfo | null> {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      const lastCommitMessage = execSync("git log -1 --pretty=%s", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      const lastCommitDateStr = execSync("git log -1 --pretty=%aI", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      const uncommittedOutput = execSync("git status --porcelain", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const uncommittedCount = uncommittedOutput
        ? uncommittedOutput.split("\n").length
        : 0;

      let ahead = 0;
      let behind = 0;
      try {
        const aheadBehind = execSync(
          "git rev-list --left-right --count HEAD...@{upstream}",
          {
            cwd: projectPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }
        ).trim();
        const parts = aheadBehind.split(/\s+/);
        ahead = parseInt(parts[0] ?? "0", 10) || 0;
        behind = parseInt(parts[1] ?? "0", 10) || 0;
      } catch {
        // No upstream configured
      }

      return {
        branch,
        lastCommitMessage,
        lastCommitAt: new Date(lastCommitDateStr),
        uncommittedCount,
        ahead,
        behind,
      };
    } catch {
      return null;
    }
  }

  /** Extract dependencies from package.json */
  async extractDependencies(projectPath: string): Promise<Dependency[]> {
    try {
      const pkgPath = join(projectPath, "package.json");
      const content = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps: Dependency[] = [];

      const addDeps = (obj: unknown) => {
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          for (const [name, version] of Object.entries(
            obj as Record<string, string>
          )) {
            deps.push({ name, version });
          }
        }
      };

      addDeps(pkg.dependencies);
      addDeps(pkg.devDependencies);

      return deps;
    } catch {
      return [];
    }
  }

  // ── Private helpers ──────────────────────────────────────

  /** Detect which tool markers exist in a directory */
  private async detectTools(dirPath: string): Promise<ToolId[]> {
    const tools: ToolId[] = [];
    const allMarkers = Object.entries(TOOL_MARKERS) as [ToolId, string][];

    for (const [toolId, markerDir] of allMarkers) {
      try {
        const markerPath = join(dirPath, markerDir);
        const s = await stat(markerPath);
        if (s.isDirectory()) {
          tools.push(toolId);
        }
      } catch {
        // Marker doesn't exist
      }
    }

    return tools;
  }

  /** Build a full Project object from a detected directory */
  private async buildProject(
    dirPath: string,
    tools: ToolId[]
  ): Promise<Project> {
    const name = basename(dirPath);
    const id = this.hashPath(dirPath);
    const gitInfo = await this.extractGitInfo(dirPath);
    const dependencies = await this.extractDependencies(dirPath);

    return {
      id,
      name,
      path: dirPath,
      tools,
      sessionCount: 0,
      sessionsThisWeek: 0,
      totalTokens: 0,
      estimatedCost: 0,
      netLines: { additions: 0, deletions: 0 },
      lastActivityAt: new Date(0),
      isActive: false,
      activitySparkline: [],
      gitInfo,
      dependencies,
      artifacts: [],
    };
  }

  /** Simple hash of a path string to produce a stable ID */
  private hashPath(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
