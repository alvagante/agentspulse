import { execSync } from "node:child_process";
import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import type {
  Project,
  ToolId,
  GitInfo,
  Dependency,
  ToolArtifact,
} from "../types.js";
import type { PluginRegistry } from "../plugins/plugin-registry.js";
import { TOOL_MARKERS } from "../constants.js";
import { querySqliteJson } from "../sqlite.js";

interface CursorComposerHeaderRow {
  value: string | null;
}

interface CursorComposerHeaders {
  allComposers?: Array<{
    workspaceIdentifier?: {
      uri?: {
        fsPath?: string;
        path?: string;
        external?: string;
      };
    };
  }>;
}

interface GooseProjectRow {
  working_dir: string;
}

interface ZedWorkspaceRow {
  paths: string | null;
}

interface DevinSessionPathData {
  projectPath?: string;
  workspaceDirectory?: string;
  workingDirectory?: string;
  cwd?: string;
  repoPath?: string;
}

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
   * - ~/.gemini/projects.json path-to-slug map
   * - Cursor global composer headers and workspaceStorage metadata
   * - Goose sessions database working_dir values
   * - Zed workspace database paths
   * - Windsurf global composer headers and workspaceStorage metadata
   * - Devin JSON/JSONL session working directories
   *
   * Returns deduplicated projects that exist on disk.
   */
  async detectProjectsFromToolData(): Promise<Project[]> {
    // Map from project path → set of tools that discovered it (for attribution
    // when no local tool marker dir exists, e.g. Gemini projects).
    const discoveredPaths = new Map<string, Set<ToolId>>();
    const home = homedir();

    await this.discoverClaudeProjects(home, discoveredPaths);
    await this.discoverCodexProjects(home, discoveredPaths);
    await this.discoverContinueProjects(home, discoveredPaths);
    await this.discoverGeminiProjects(home, discoveredPaths);
    await this.discoverCursorProjects(home, discoveredPaths);
    await this.discoverGooseProjects(home, discoveredPaths);
    await this.discoverZedProjects(home, discoveredPaths);
    await this.discoverWindsurfProjects(home, discoveredPaths);
    await this.discoverDevinProjects(home, discoveredPaths);

    // Build Project objects for paths that exist on disk
    const projects: Project[] = [];
    for (const [dirPath, attributedTools] of discoveredPaths) {
      try {
        await access(dirPath);
        const s = await stat(dirPath);
        if (!s.isDirectory()) continue;
        // Merge local marker detection with tools attributed via session data
        const detectedTools = await this.detectTools(dirPath);
        const tools: ToolId[] = [
          ...new Set([...detectedTools, ...attributedTools]),
        ];
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

  /** Add a path+tool attribution to the discovered paths map */
  private addDiscoveredPath(
    map: Map<string, Set<ToolId>>,
    path: string,
    toolId: ToolId
  ): void {
    if (!map.has(path)) map.set(path, new Set());
    map.get(path)!.add(toolId);
  }

  /** Discover project paths from ~/.claude/projects/ directory names */
  private async discoverClaudeProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const projectsDir = join(home, ".claude", "projects");
    try {
      const entries = await readdir(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const decoded = this.decodeClaudeProjectPath(entry.name);
        if (decoded && decoded !== "/") {
          this.addDiscoveredPath(paths, decoded, "claude");
        }
      }
    } catch {
      // No projects directory
    }
  }

  /** Discover project paths from ~/.codex/sessions/ JSONL files (session_meta.payload.cwd) */
  private async discoverCodexProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
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
  private async extractCwdFromCodexFile(
    filePath: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const firstLine = content.split("\n")[0];
      if (!firstLine) return;
      const entry = JSON.parse(firstLine) as Record<string, unknown>;
      if (entry.type === "session_meta") {
        const payload = entry.payload as Record<string, unknown> | undefined;
        if (payload?.cwd && typeof payload.cwd === "string") {
          this.addDiscoveredPath(paths, payload.cwd, "codex");
        }
      }
    } catch {
      // Can't read or parse
    }
  }

  /** Discover project paths from ~/.continue/sessions/ JSON files (workspaceDirectory) */
  private async discoverContinueProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const sessionsDir = join(home, ".continue", "sessions");
    try {
      const entries = await readdir(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const filePath = join(sessionsDir, entry.name);
        try {
          const content = await readFile(filePath, "utf-8");
          const data = JSON.parse(content) as Record<string, unknown>;
          if (
            data.workspaceDirectory &&
            typeof data.workspaceDirectory === "string" &&
            data.workspaceDirectory !== ""
          ) {
            this.addDiscoveredPath(paths, data.workspaceDirectory, "continue");
          }
        } catch {
          // Can't read or parse
        }
      }
    } catch {
      // No sessions directory
    }
  }

  /** Discover project paths from ~/.gemini/projects.json */
  private async discoverGeminiProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const projectsJsonPath = join(home, ".gemini", "projects.json");
    try {
      const content = await readFile(projectsJsonPath, "utf-8");
      const data = JSON.parse(content) as {
        projects?: Record<string, string>;
      };
      if (data.projects) {
        for (const projectPath of Object.keys(data.projects)) {
          if (projectPath) this.addDiscoveredPath(paths, projectPath, "gemini");
        }
      }
    } catch {
      // No projects.json
    }
  }

  /** Discover project paths from Cursor composer headers and workspace storage */
  private async discoverCursorProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    await this.discoverCursorComposerProjects(home, paths);
    await this.discoverCursorWorkspaceStorageProjects(home, paths);
  }

  private async discoverCursorComposerProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const stateDb = join(
      home,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );

    try {
      const rows = await querySqliteJson<CursorComposerHeaderRow>(
        stateDb,
        `select cast(value as text) as value
         from ItemTable
         where key = 'composer.composerHeaders'`
      );
      const value = rows[0]?.value;
      if (!value) return;

      const parsed = JSON.parse(value) as CursorComposerHeaders;
      for (const composer of parsed.allComposers ?? []) {
        const uri = composer.workspaceIdentifier?.uri;
        const projectPath = uri?.fsPath ?? uri?.path ?? uriToPath(uri?.external);
        if (projectPath) this.addDiscoveredPath(paths, projectPath, "cursor");
      }
    } catch {
      // No Cursor global state DB or unreadable composer headers
    }
  }

  private async discoverCursorWorkspaceStorageProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const workspaceStorage = join(
      home,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "workspaceStorage"
    );

    try {
      const entries = await readdir(workspaceStorage, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const workspaceJsonPath = join(workspaceStorage, entry.name, "workspace.json");
        try {
          const content = await readFile(workspaceJsonPath, "utf-8");
          const data = JSON.parse(content) as { folder?: string };
          const projectPath = uriToPath(data.folder);
          if (projectPath) this.addDiscoveredPath(paths, projectPath, "cursor");
        } catch {
          // No readable workspace metadata
        }
      }
    } catch {
      // No Cursor workspace storage
    }
  }

  /** Discover project paths from Goose sessions.db working_dir values */
  private async discoverGooseProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const dbPath = join(home, ".local", "share", "goose", "sessions", "sessions.db");
    try {
      const rows = await querySqliteJson<GooseProjectRow>(
        dbPath,
        `select distinct working_dir
         from sessions
         where working_dir is not null and working_dir != ''`
      );
      for (const row of rows) {
        this.addDiscoveredPath(paths, row.working_dir, "goose");
      }
    } catch {
      // No Goose sessions database
    }
  }

  /** Discover project paths from Zed workspace state */
  private async discoverZedProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const dbPath = join(home, "Library", "Application Support", "Zed", "db", "0-stable", "db.sqlite");
    try {
      const rows = await querySqliteJson<ZedWorkspaceRow>(
        dbPath,
        `select paths from workspaces where paths is not null and paths != ''`
      );
      for (const row of rows) {
        for (const projectPath of parsePathList(row.paths)) {
          this.addDiscoveredPath(paths, projectPath, "zed");
        }
      }
    } catch {
      // No Zed workspace database
    }
  }

  /** Discover project paths from Windsurf composer headers and workspace storage */
  private async discoverWindsurfProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    for (const root of windsurfUserDirs(home)) {
      await this.discoverWindsurfComposerProjects(root, paths);
      await this.discoverWindsurfWorkspaceStorageProjects(root, paths);
    }
  }

  private async discoverWindsurfComposerProjects(
    root: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const stateDb = join(root, "globalStorage", "state.vscdb");
    try {
      const rows = await querySqliteJson<CursorComposerHeaderRow>(
        stateDb,
        `select cast(value as text) as value
         from ItemTable
         where key = 'composer.composerHeaders'`
      );
      const value = rows[0]?.value;
      if (!value) return;

      const parsed = JSON.parse(value) as CursorComposerHeaders;
      for (const composer of parsed.allComposers ?? []) {
        const uri = composer.workspaceIdentifier?.uri;
        const projectPath = uri?.fsPath ?? uri?.path ?? uriToPath(uri?.external);
        if (projectPath) this.addDiscoveredPath(paths, projectPath, "windsurf");
      }
    } catch {
      // No readable Windsurf global state
    }
  }

  private async discoverWindsurfWorkspaceStorageProjects(
    root: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const workspaceStorage = join(root, "workspaceStorage");
    try {
      const entries = await readdir(workspaceStorage, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const workspaceJsonPath = join(workspaceStorage, entry.name, "workspace.json");
        try {
          const content = await readFile(workspaceJsonPath, "utf-8");
          const data = JSON.parse(content) as { folder?: string };
          const projectPath = uriToPath(data.folder);
          if (projectPath) this.addDiscoveredPath(paths, projectPath, "windsurf");
        } catch {
          // No readable workspace metadata
        }
      }
    } catch {
      // No Windsurf workspace storage
    }
  }

  /** Discover project paths from Devin JSON/JSONL session files */
  private async discoverDevinProjects(
    home: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    const roots = [
      join(home, ".devin", "sessions"),
      join(home, ".devin", "history"),
      join(home, "Library", "Application Support", "Devin", "sessions"),
    ];
    for (const root of roots) {
      await this.discoverDevinSessionDir(root, paths);
    }
  }

  private async discoverDevinSessionDir(
    dirPath: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.discoverDevinSessionDir(fullPath, paths);
        } else if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl"))) {
          await this.extractProjectPathFromDevinFile(fullPath, paths);
        }
      }
    } catch {
      // No Devin session directory
    }
  }

  private async extractProjectPathFromDevinFile(
    filePath: string,
    paths: Map<string, Set<ToolId>>
  ): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const data = filePath.endsWith(".jsonl")
        ? firstJsonlObject(content)
        : (JSON.parse(content) as DevinSessionPathData);
      const projectPath =
        data.projectPath ??
        data.workspaceDirectory ??
        data.workingDirectory ??
        data.cwd ??
        data.repoPath;
      if (projectPath) this.addDiscoveredPath(paths, projectPath, "devin");
    } catch {
      // Can't read or parse Devin session file
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

function uriToPath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith("file://")) return uri;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

function windsurfUserDirs(home: string): string[] {
  return [
    join(home, "Library", "Application Support", "Windsurf", "User"),
    join(home, ".codeium", "windsurf"),
    join(home, ".windsurf"),
  ];
}

function parsePathList(value: string | null): string[] {
  if (!value) return [];
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === "string" && item !== "");
  }
  return value.split("\n").filter(Boolean);
}

function firstJsonlObject(content: string): DevinSessionPathData {
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    const data = JSON.parse(line) as DevinSessionPathData;
    if (
      data.projectPath ||
      data.workspaceDirectory ||
      data.workingDirectory ||
      data.cwd ||
      data.repoPath
    ) {
      return data;
    }
  }
  return {};
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
