import { execSync } from "node:child_process";
import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, basename } from "node:path";
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
        // No upstream configured — ahead/behind stay 0
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
        // Marker doesn't exist — skip
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
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
