import { Router } from "express";
import type { SessionStore } from "../store/session-store.js";
import type { Scanner } from "../scanner/scanner.js";
import type { ConfigViewer } from "../scanner/config-viewer.js";
import type { PluginRegistry } from "../plugins/plugin-registry.js";
import type {
  ToolId,
  SessionFilter,
  ArtifactFilter,
  SessionSummary,
  ProjectSummary,
  ToolSummary,
  ToolBreakdownEntry,
  ProjectStats,
} from "../types.js";

export interface ApiDeps {
  store: SessionStore;
  scanner: Scanner;
  configViewer: ConfigViewer;
  registry: PluginRegistry;
}

export function createApiRouter(deps: ApiDeps): Router {
  const { store, scanner, configViewer, registry } = deps;
  const router = Router();

  // GET /api/dashboard
  router.get("/dashboard", (_req, res) => {
    try {
      const stats = store.getDashboardStats();

      const allSessions = store.getSessions({});
      const activeSessions: SessionSummary[] = allSessions
        .filter((s) => s.status === "active")
        .map((s) => ({
          id: s.id,
          toolId: s.toolId,
          title: s.title,
          status: s.status,
          projectPath: s.projectPath,
          projectName: s.projectName,
          startedAt: s.startedAt,
          durationMs: s.durationMs,
          tokens: s.tokens.used,
          lastPrompt: s.events.find((e) => e.type === "user_prompt")
            ? (s.events.find((e) => e.type === "user_prompt") as any).text?.slice(0, 120)
            : undefined,
        }));

      const recentProjects: ProjectSummary[] = store
        .getProjects()
        .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.name,
          path: p.path,
          tools: p.tools,
          sessionCount: p.sessionCount,
          lastActivityAt: p.lastActivityAt,
          isActive: p.isActive,
        }));

      const toolSummaries: ToolSummary[] = registry.getPlugins().map((p) => {
        const configs = store.getConfigs("user-home");
        const fileCount = configs.filter((c) => c.toolId === p.id).length;
        return {
          toolId: p.id,
          displayName: p.displayName,
          color: p.color,
          homePath: `~/${p.configDirNames[0] ?? ""}`,
          fileCount,
          detectionMethod: p.detectionMethod,
        };
      });

      res.json({
        stats,
        activeSessions,
        recentProjects,
        toolSummaries,
        lastScanAt: store.getLastScanTime()?.toISOString() ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  // GET /api/sessions
  router.get("/sessions", (req, res) => {
    try {
      const filter: SessionFilter = {};
      if (req.query.tool) filter.tool = req.query.tool as ToolId;
      if (req.query.status) filter.status = req.query.status as SessionFilter["status"];
      if (req.query.dateRange) filter.dateRange = req.query.dateRange as SessionFilter["dateRange"];
      if (req.query.projectId) filter.projectId = req.query.projectId as string;
      if (req.query.search) filter.search = req.query.search as string;
      if (req.query.sortBy) filter.sortBy = req.query.sortBy as SessionFilter["sortBy"];
      if (req.query.sortOrder) filter.sortOrder = req.query.sortOrder as SessionFilter["sortOrder"];

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      filter.page = page;
      filter.limit = limit;

      const sessions = store.getSessions(filter);
      const summaries: SessionSummary[] = sessions.map((s) => ({
        id: s.id,
        toolId: s.toolId,
        title: s.title,
        status: s.status,
        projectPath: s.projectPath,
        projectName: s.projectName,
        startedAt: s.startedAt,
        durationMs: s.durationMs,
        tokens: s.tokens.used,
        lastPrompt: s.events.find((e) => e.type === "user_prompt")
          ? (s.events.find((e) => e.type === "user_prompt") as any).text?.slice(0, 120)
          : undefined,
      }));

      // Get total count without pagination
      const totalFilter = { ...filter };
      delete totalFilter.page;
      delete totalFilter.limit;
      const total = store.getSessions(totalFilter).length;

      res.json({
        sessions: summaries,
        total,
        page,
        limit,
        filters: {
          tool: filter.tool,
          status: filter.status,
          dateRange: filter.dateRange,
          projectId: filter.projectId,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load sessions" });
    }
  });

  // GET /api/sessions/:id
  router.get("/sessions/:id", (req, res) => {
    try {
      const session = store.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json({
        session,
        files: session.filesModified,
        config: session.config,
        sourceFiles: session.sourceFiles,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load session" });
    }
  });

  // GET /api/projects
  router.get("/projects", (_req, res) => {
    try {
      const projects = store.getProjects();
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: "Failed to load projects" });
    }
  });

  // GET /api/projects/:id
  router.get("/projects/:id", (req, res) => {
    try {
      const project = store.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Compute stats
      const allSessions = store.getSessions({});
      const projectSessions = allSessions.filter(
        (s) => s.projectPath === project.path
      );

      const stats: ProjectStats = {
        totalSessions: projectSessions.length,
        toolsUsed: [...new Set(projectSessions.map((s) => s.toolId))],
        totalTokens: projectSessions.reduce((sum, s) => sum + s.tokens.used, 0),
        estimatedCost: projectSessions.reduce((sum, s) => sum + s.estimatedCost, 0),
        netLines: {
          additions: projectSessions.reduce((sum, s) => sum + s.netLines.additions, 0),
          deletions: projectSessions.reduce((sum, s) => sum + s.netLines.deletions, 0),
        },
      };

      // Tool breakdown
      const toolCounts = new Map<ToolId, number>();
      for (const s of projectSessions) {
        toolCounts.set(s.toolId, (toolCounts.get(s.toolId) ?? 0) + 1);
      }
      const maxCount = Math.max(...toolCounts.values(), 1);
      const toolBreakdown: ToolBreakdownEntry[] = [];
      for (const [toolId, count] of toolCounts) {
        const plugin = registry.getPlugin(toolId);
        toolBreakdown.push({
          toolId,
          displayName: plugin?.displayName ?? toolId,
          sessionCount: count,
          proportion: count / maxCount,
        });
      }

      // Session summaries
      const sessions: SessionSummary[] = projectSessions
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .map((s) => ({
          id: s.id,
          toolId: s.toolId,
          title: s.title,
          status: s.status,
          projectPath: s.projectPath,
          projectName: s.projectName,
          startedAt: s.startedAt,
          durationMs: s.durationMs,
          tokens: s.tokens.used,
        }));

      // Activity sparkline: 30 data points (sessions per day)
      const now = new Date();
      const activitySparkline: number[] = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = projectSessions.filter(
          (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
        ).length;
        activitySparkline.push(count);
      }

      const artifacts = store.getArtifacts({ projectPath: project.path });

      res.json({
        project,
        stats,
        sessions,
        toolBreakdown,
        artifacts,
        gitInfo: project.gitInfo,
        dependencies: project.dependencies,
        activitySparkline,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load project" });
    }
  });

  // GET /api/configs
  router.get("/configs", (req, res) => {
    try {
      const scope = req.query.scope as "user-home" | "system" | undefined;
      let configs = store.getConfigs(scope);

      if (req.query.fileType) {
        const fileType = req.query.fileType as string;
        configs = configs.filter((c) => c.fileType === fileType);
      }
      if (req.query.tool) {
        const tool = req.query.tool as string;
        configs = configs.filter((c) => c.toolId === tool);
      }

      res.json({ configs });
    } catch (err) {
      res.status(500).json({ error: "Failed to load configs" });
    }
  });

  // GET /api/configs/view
  router.get("/configs/view", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        res.status(400).json({ error: "Missing required query parameter: path" });
        return;
      }
      const result = await configViewer.readFile(filePath);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to read config file" });
    }
  });

  // GET /api/artifacts
  router.get("/artifacts", (req, res) => {
    try {
      const filter: ArtifactFilter = {};
      if (req.query.tool) filter.tool = req.query.tool as ToolId;
      if (req.query.category) filter.category = req.query.category as string;
      if (req.query.scope) filter.scope = req.query.scope as ArtifactFilter["scope"];

      const artifacts = store.getArtifacts(filter);
      res.json({ artifacts });
    } catch (err) {
      res.status(500).json({ error: "Failed to load artifacts" });
    }
  });

  // GET /api/artifacts/view
  router.get("/artifacts/view", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        res.status(400).json({ error: "Missing required query parameter: path" });
        return;
      }
      const result = await configViewer.readFile(filePath);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to read artifact file" });
    }
  });

  // POST /api/rescan
  router.post("/rescan", async (_req, res) => {
    try {
      const result = await scanner.fullScan();
      res.json({
        success: true,
        scannedAt: result.scannedAt.toISOString(),
        durationMs: result.durationMs,
        errors: result.errors,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Rescan failed",
      });
    }
  });

  // GET /api/tools
  router.get("/tools", (_req, res) => {
    try {
      const plugins = registry.getPlugins();
      const tools: ToolSummary[] = plugins.map((p) => {
        const configs = store.getConfigs("user-home");
        const fileCount = configs.filter((c) => c.toolId === p.id).length;
        return {
          toolId: p.id,
          displayName: p.displayName,
          color: p.color,
          homePath: `~/${p.configDirNames[0] ?? ""}`,
          fileCount,
          detectionMethod: p.detectionMethod,
        };
      });
      res.json({ tools });
    } catch (err) {
      res.status(500).json({ error: "Failed to load tools" });
    }
  });

  // GET /api/search
  router.get("/search", (req, res) => {
    try {
      const q = (req.query.q as string ?? "").toLowerCase().trim();
      if (!q) {
        res.status(400).json({ error: "Missing required query parameter: q" });
        return;
      }

      const sessions = store.getSessions({}).filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q)
      ).slice(0, 20).map((s) => ({
        id: s.id,
        toolId: s.toolId,
        title: s.title,
        status: s.status,
        projectPath: s.projectPath,
        projectName: s.projectName,
        startedAt: s.startedAt,
        durationMs: s.durationMs,
        tokens: s.tokens.used,
      }));

      const projects = store.getProjects().filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q)
      ).slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        tools: p.tools,
        sessionCount: p.sessionCount,
        lastActivityAt: p.lastActivityAt,
        isActive: p.isActive,
      }));

      const configs = store.getConfigs().filter(
        (c) => c.path.toLowerCase().includes(q)
      ).slice(0, 20);

      res.json({ sessions, projects, configs });
    } catch (err) {
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  return router;
}
