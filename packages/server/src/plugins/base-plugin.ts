import { execFile } from "node:child_process";
import { access, readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import type { ToolPlugin } from "./plugin-interface.js";
import type {
  ToolId,
  ArtifactCategory,
  DetectionResult,
  ConfigFile,
  ToolArtifact,
  Session,
  ScanScope,
} from "../types.js";

const execFileAsync = promisify(execFile);

/** File type detection from extension */
export function getFileType(
  filePath: string
): "json" | "yaml" | "toml" | "markdown" | "other" {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".toml":
      return "toml";
    case ".md":
      return "markdown";
    default:
      return "other";
  }
}

/** Config file definition used by plugins to declare what to look for */
export interface ConfigFileEntry {
  /** Relative path within the config dir, e.g. "settings.json" */
  relativePath: string;
}

/** Artifact directory/file definition */
export interface ArtifactEntry {
  /** Relative path within the config dir, e.g. "agents/" or "CLAUDE.md" */
  relativePath: string;
  /** Category for discovered artifacts */
  category: ArtifactCategory;
  /** If true, treat as a directory and discover all files inside */
  isDirectory: boolean;
}

/**
 * Abstract base class implementing common ToolPlugin logic.
 * Concrete plugins extend this and provide their specific configuration.
 */
export abstract class BasePlugin implements ToolPlugin {
  abstract readonly id: ToolId;
  abstract readonly displayName: string;
  abstract readonly color: string;
  abstract readonly artifactCategories: ArtifactCategory[];
  abstract readonly configDirNames: string[];
  abstract readonly commandNames: string[];
  abstract readonly systemPaths: string[];

  /** Config files to look for (relative to the tool's config dir) */
  protected abstract readonly configFiles: ConfigFileEntry[];

  /** Artifact entries to discover */
  protected abstract readonly artifactEntries: ArtifactEntry[];

  detectionMethod: "config" | "command" | "both" = "config";

  /** Check if this plugin is available on the current system */
  async detect(): Promise<DetectionResult> {
    const configPaths: string[] = [];
    let commandPath: string | undefined;

    // Check config directories in home
    const home = homedir();
    for (const dirName of this.configDirNames) {
      const dirPath = join(home, dirName);
      try {
        await access(dirPath);
        configPaths.push(dirPath);
      } catch {
        // Not found
      }
    }

    // Check commands in PATH
    for (const cmd of this.commandNames) {
      try {
        const { stdout } = await execFileAsync("which", [cmd]);
        const resolved = stdout.trim();
        if (resolved) {
          commandPath = resolved;
          break;
        }
      } catch {
        // Command not found
      }
    }

    const hasConfig = configPaths.length > 0;
    const hasCommand = !!commandPath;

    let method: DetectionResult["method"] = "none";
    if (hasConfig && hasCommand) method = "both";
    else if (hasConfig) method = "config";
    else if (hasCommand) method = "command";

    this.detectionMethod = method === "none" ? "config" : (method as "config" | "command" | "both");

    return {
      detected: hasConfig || hasCommand,
      method,
      configPaths,
      commandPath,
    };
  }

  /** Discover config files at a given scope */
  async discoverConfigs(scope: ScanScope): Promise<ConfigFile[]> {
    const configs: ConfigFile[] = [];
    const baseDirs = this.getBaseDirs(scope);

    for (const baseDir of baseDirs) {
      for (const entry of this.configFiles) {
        const filePath = join(baseDir, entry.relativePath);
        try {
          const s = await stat(filePath);
          if (s.isFile()) {
            configs.push({
              path: filePath,
              toolId: this.id,
              scope: scope.level,
              fileType: getFileType(filePath),
              size: s.size,
              lastModified: s.mtime,
            });
          }
        } catch {
          // File doesn't exist — skip
        }
      }
    }

    return configs;
  }

  /** Discover all tool artifacts at a given scope */
  async discoverArtifacts(scope: ScanScope): Promise<ToolArtifact[]> {
    const artifacts: ToolArtifact[] = [];
    const baseDirs = this.getBaseDirs(scope);

    for (const baseDir of baseDirs) {
      for (const entry of this.artifactEntries) {
        const targetPath = join(baseDir, entry.relativePath);
        try {
          const s = await stat(targetPath);
          if (entry.isDirectory && s.isDirectory()) {
            // Discover all files inside the directory
            const files = await this.walkDir(targetPath);
            for (const file of files) {
              const fileStat = await stat(file);
              artifacts.push({
                path: file,
                toolId: this.id,
                category: entry.category,
                scope: scope.level,
                projectPath: scope.level === "project" ? scope.basePath : undefined,
                fileType: getFileType(file),
                size: fileStat.size,
                lastModified: fileStat.mtime,
              });
            }
          } else if (!entry.isDirectory && s.isFile()) {
            artifacts.push({
              path: targetPath,
              toolId: this.id,
              category: entry.category,
              scope: scope.level,
              projectPath: scope.level === "project" ? scope.basePath : undefined,
              fileType: getFileType(targetPath),
              size: s.size,
              lastModified: s.mtime,
            });
          }
        } catch {
          // Path doesn't exist — skip
        }
      }
    }

    return artifacts;
  }

  /** Stub session parsing — subclasses can override for real parsing */
  async parseSessions(_projectPath: string): Promise<Session[]> {
    return [];
  }

  /** Stub single session file parsing — subclasses can override */
  async parseSessionFile(_filePath: string): Promise<Session | null> {
    return null;
  }

  // ── Protected helpers ──────────────────────────────────────

  /** Get the tool-specific directories to scan for a given scope */
  protected getBaseDirs(scope: ScanScope): string[] {
    const dirs: string[] = [];
    if (scope.level === "user-home") {
      for (const dirName of this.configDirNames) {
        dirs.push(join(scope.basePath, dirName));
      }
    } else if (scope.level === "system") {
      dirs.push(...this.systemPaths);
    } else if (scope.level === "project") {
      for (const dirName of this.configDirNames) {
        dirs.push(join(scope.basePath, dirName));
      }
    }
    return dirs;
  }

  /** Recursively walk a directory and return all file paths */
  protected async walkDir(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.walkDir(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Can't read directory — skip
    }
    return files;
  }

  /** Generate a stable session ID from a file path */
  protected generateSessionId(filePath: string): string {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `${this.id}-${Math.abs(hash).toString(36)}`;
  }
}
