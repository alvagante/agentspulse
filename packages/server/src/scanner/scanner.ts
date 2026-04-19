import { homedir } from "node:os";
import { join } from "node:path";
import { access } from "node:fs/promises";
import type {
  ScanResult,
  ScanScope,
  ScanError,
  Session,
  ConfigFile,
  ToolArtifact,
  Project,
} from "../types.js";
import type { PluginRegistry } from "../plugins/plugin-registry.js";
import type { SessionStore } from "../store/session-store.js";
import { ProjectDetector } from "./project-detector.js";

/**
 * Orchestrates filesystem scanning across all plugins and scopes.
 */
export class Scanner {
  private projectDetector: ProjectDetector;

  constructor(
    private registry: PluginRegistry,
    private store: SessionStore,
    private projectRoots: string[]
  ) {
    this.projectDetector = new ProjectDetector(registry);
  }

  /** Full scan across all scopes: user-home, system, and project directories */
  async fullScan(): Promise<ScanResult> {
    const start = Date.now();
    const errors: ScanError[] = [];
    const allSessions: Session[] = [];
    const allConfigs: ConfigFile[] = [];
    const allArtifacts: ToolArtifact[] = [];

    const home = homedir();
    const plugins = this.registry.getPlugins();

    // Scan user-home scope
    const homeScope: ScanScope = { level: "user-home", basePath: home };
    for (const plugin of plugins) {
      try {
        const configs = await plugin.discoverConfigs(homeScope);
        allConfigs.push(...configs);
      } catch (err) {
        errors.push(this.toScanError(home, plugin.id, err));
      }
      try {
        const artifacts = await plugin.discoverArtifacts(homeScope);
        allArtifacts.push(...artifacts);
      } catch (err) {
        errors.push(this.toScanError(home, plugin.id, err));
      }
    }

    // Scan system scope
    const systemScope: ScanScope = { level: "system", basePath: "/etc" };
    for (const plugin of plugins) {
      try {
        await access("/etc");
        const configs = await plugin.discoverConfigs(systemScope);
        allConfigs.push(...configs);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "EACCES") {
          errors.push({
            path: "/etc",
            pluginId: plugin.id,
            message: "Permission denied accessing /etc",
            code: "EACCES",
          });
        }
        // ENOENT or other — just skip
      }
      try {
        const artifacts = await plugin.discoverArtifacts(systemScope);
        allArtifacts.push(...artifacts);
      } catch {
        // Skip silently for system artifacts
      }
    }

    // Detect projects
    const projects = await this.projectDetector.detectProjects(
      this.projectRoots
    );

    // Scan each project
    for (const project of projects) {
      const projectScope: ScanScope = {
        level: "project",
        basePath: project.path,
      };
      for (const plugin of plugins) {
        try {
          const configs = await plugin.discoverConfigs(projectScope);
          allConfigs.push(...configs);
        } catch (err) {
          errors.push(this.toScanError(project.path, plugin.id, err));
        }
        try {
          const artifacts = await plugin.discoverArtifacts(projectScope);
          allArtifacts.push(...artifacts);
          project.artifacts.push(...artifacts);
        } catch (err) {
          errors.push(this.toScanError(project.path, plugin.id, err));
        }
        try {
          const sessions = await plugin.parseSessions(project.path);
          allSessions.push(...sessions);
        } catch (err) {
          errors.push(this.toScanError(project.path, plugin.id, err));
        }
      }
    }

    const result: ScanResult = {
      sessions: allSessions,
      projects,
      configs: allConfigs,
      artifacts: allArtifacts,
      errors,
      scannedAt: new Date(),
      durationMs: Date.now() - start,
    };

    this.store.update(result);
    return result;
  }

  /** Scan only user-home and system configs (no project scanning) */
  async scanUserSystem(): Promise<ScanResult> {
    const start = Date.now();
    const errors: ScanError[] = [];
    const allConfigs: ConfigFile[] = [];
    const allArtifacts: ToolArtifact[] = [];

    const home = homedir();
    const plugins = this.registry.getPlugins();

    // User-home scope
    const homeScope: ScanScope = { level: "user-home", basePath: home };
    for (const plugin of plugins) {
      try {
        const configs = await plugin.discoverConfigs(homeScope);
        allConfigs.push(...configs);
      } catch (err) {
        errors.push(this.toScanError(home, plugin.id, err));
      }
      try {
        const artifacts = await plugin.discoverArtifacts(homeScope);
        allArtifacts.push(...artifacts);
      } catch (err) {
        errors.push(this.toScanError(home, plugin.id, err));
      }
    }

    // System scope
    const systemScope: ScanScope = { level: "system", basePath: "/etc" };
    for (const plugin of plugins) {
      try {
        await access("/etc");
        const configs = await plugin.discoverConfigs(systemScope);
        allConfigs.push(...configs);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "EACCES") {
          errors.push({
            path: "/etc",
            pluginId: plugin.id,
            message: "Permission denied accessing /etc",
            code: "EACCES",
          });
        }
      }
      try {
        const artifacts = await plugin.discoverArtifacts(systemScope);
        allArtifacts.push(...artifacts);
      } catch {
        // Skip silently
      }
    }

    const result: ScanResult = {
      sessions: [],
      projects: [],
      configs: allConfigs,
      artifacts: allArtifacts,
      errors,
      scannedAt: new Date(),
      durationMs: Date.now() - start,
    };

    this.store.update(result);
    return result;
  }

  /** Scan a single project directory */
  async scanProject(path: string): Promise<ScanResult> {
    const start = Date.now();
    const errors: ScanError[] = [];
    const allSessions: Session[] = [];
    const allConfigs: ConfigFile[] = [];
    const allArtifacts: ToolArtifact[] = [];

    const plugins = this.registry.getPlugins();
    const projectScope: ScanScope = { level: "project", basePath: path };

    for (const plugin of plugins) {
      try {
        const configs = await plugin.discoverConfigs(projectScope);
        allConfigs.push(...configs);
      } catch (err) {
        errors.push(this.toScanError(path, plugin.id, err));
      }
      try {
        const artifacts = await plugin.discoverArtifacts(projectScope);
        allArtifacts.push(...artifacts);
      } catch (err) {
        errors.push(this.toScanError(path, plugin.id, err));
      }
      try {
        const sessions = await plugin.parseSessions(path);
        allSessions.push(...sessions);
      } catch (err) {
        errors.push(this.toScanError(path, plugin.id, err));
      }
    }

    const result: ScanResult = {
      sessions: allSessions,
      projects: [],
      configs: allConfigs,
      artifacts: allArtifacts,
      errors,
      scannedAt: new Date(),
      durationMs: Date.now() - start,
    };

    this.store.update(result);
    return result;
  }

  // ── Private helpers ──────────────────────────────────────

  private toScanError(
    path: string,
    pluginId: string,
    err: unknown
  ): ScanError {
    const nodeErr = err as NodeJS.ErrnoException;
    let code: ScanError["code"] = "UNKNOWN";
    if (nodeErr.code === "EACCES") code = "EACCES";
    else if (nodeErr.code === "ENOENT") code = "ENOENT";

    return {
      path,
      pluginId: pluginId as ScanError["pluginId"],
      message: nodeErr.message ?? String(err),
      code,
    };
  }
}
