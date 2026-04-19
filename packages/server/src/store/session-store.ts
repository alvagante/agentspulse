import type {
  Session,
  Project,
  ConfigFile,
  ToolArtifact,
  ScanResult,
  SessionFilter,
  ArtifactFilter,
  DashboardStats,
} from "../types.js";

/**
 * In-memory cache of all parsed scan data.
 * Provides query methods for the API layer.
 */
export class SessionStore {
  private sessions: Session[] = [];
  private projects: Project[] = [];
  private configs: ConfigFile[] = [];
  private artifacts: ToolArtifact[] = [];
  private lastScanTime: Date | null = null;

  /** Replace all data from a scan result */
  update(result: ScanResult): void {
    this.sessions = result.sessions;
    this.projects = result.projects;
    this.configs = result.configs;
    this.artifacts = result.artifacts;
    this.lastScanTime = result.scannedAt;
  }

  /** Query sessions with filters, sorting, and pagination */
  getSessions(filter: SessionFilter): Session[] {
    let result = [...this.sessions];

    // Filter by tool
    if (filter.tool) {
      result = result.filter((s) => s.toolId === filter.tool);
    }

    // Filter by status
    if (filter.status) {
      result = result.filter((s) => s.status === filter.status);
    }

    // Filter by date range
    if (filter.dateRange && filter.dateRange !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (filter.dateRange) {
        case "today": {
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        }
        case "7d": {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case "30d": {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
      }
      result = result.filter((s) => s.startedAt >= cutoff!);
    }

    // Filter by search text (match against title or projectName)
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q)
      );
    }

    // Filter by projectId
    if (filter.projectId) {
      const project = this.projects.find((p) => p.id === filter.projectId);
      if (project) {
        result = result.filter((s) => s.projectPath === project.path);
      } else {
        result = [];
      }
    }

    // Sort
    const sortBy = filter.sortBy ?? "startedAt";
    const sortOrder = filter.sortOrder ?? "desc";
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "startedAt":
          cmp = a.startedAt.getTime() - b.startedAt.getTime();
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "tokens":
          cmp = a.tokens.used - b.tokens.used;
          break;
        case "duration":
          cmp = a.durationMs - b.durationMs;
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    // Pagination
    if (filter.page !== undefined && filter.limit !== undefined) {
      const start = (filter.page - 1) * filter.limit;
      result = result.slice(start, start + filter.limit);
    }

    return result;
  }

  /** Get a single session by ID */
  getSession(id: string): Session | null {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  /** Get all projects */
  getProjects(): Project[] {
    return [...this.projects];
  }

  /** Get a single project by id, path, or name */
  getProject(identifier: string): Project | null {
    return (
      this.projects.find(
        (p) =>
          p.id === identifier ||
          p.path === identifier ||
          p.name === identifier
      ) ?? null
    );
  }

  /** Get configs, optionally filtered by scope */
  getConfigs(scope?: "user-home" | "system"): ConfigFile[] {
    if (scope) {
      return this.configs.filter((c) => c.scope === scope);
    }
    return [...this.configs];
  }

  /** Get artifacts, optionally filtered */
  getArtifacts(filter?: ArtifactFilter): ToolArtifact[] {
    if (!filter) {
      return [...this.artifacts];
    }
    let result = [...this.artifacts];
    if (filter.tool) {
      result = result.filter((a) => a.toolId === filter.tool);
    }
    if (filter.category) {
      result = result.filter((a) => a.category === filter.category);
    }
    if (filter.scope) {
      result = result.filter((a) => a.scope === filter.scope);
    }
    if (filter.projectPath) {
      result = result.filter((a) => a.projectPath === filter.projectPath);
    }
    return result;
  }

  /** Dashboard aggregate stats */
  getDashboardStats(): DashboardStats {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeSessions = this.sessions.filter(
      (s) => s.status === "active"
    ).length;

    const sessionsThisWeek = this.sessions.filter(
      (s) => s.startedAt >= weekAgo
    ).length;

    const projectsTouched = new Set(
      this.sessions
        .filter((s) => s.startedAt >= weekAgo)
        .map((s) => s.projectPath)
    ).size;

    const toolsDetected = new Set(
      this.sessions.map((s) => s.toolId)
    ).size;

    return {
      activeSessions,
      sessionsThisWeek,
      projectsTouched,
      toolsDetected,
    };
  }

  /** Last scan timestamp */
  getLastScanTime(): Date | null {
    return this.lastScanTime;
  }
}
