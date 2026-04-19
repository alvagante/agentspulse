import type {
  ToolId,
  ArtifactCategory,
  DetectionResult,
  ConfigFile,
  ToolArtifact,
  Session,
  ScanScope,
} from "../types.js";

/**
 * Core plugin interface — every AI tool plugin implements this.
 * This is the primary extensibility point for adding new tool support.
 */
export interface ToolPlugin {
  /** Unique tool identifier, e.g. "claude", "kiro" */
  readonly id: ToolId;

  /** Human-readable display name, e.g. "Claude Code" */
  readonly displayName: string;

  /** Tool-specific brand color hex, e.g. "#b8693a" */
  readonly color: string;

  /** How this plugin was detected */
  readonly detectionMethod: "config" | "command" | "both";

  /** Artifact categories this plugin supports */
  readonly artifactCategories: ArtifactCategory[];

  /** Config directory names to look for at home/project level */
  readonly configDirNames: string[];

  /** Command names to check in PATH */
  readonly commandNames: string[];

  /** System-level config paths */
  readonly systemPaths: string[];

  /** Check if this plugin is available on the current system */
  detect(): Promise<DetectionResult>;

  /** Discover config files at a given scope */
  discoverConfigs(scope: ScanScope): Promise<ConfigFile[]>;

  /** Discover all tool artifacts at a given scope */
  discoverArtifacts(scope: ScanScope): Promise<ToolArtifact[]>;

  /** Parse session data from tool-specific files */
  parseSessions(projectPath: string): Promise<Session[]>;

  /** Extract session metadata from a raw session file */
  parseSessionFile(filePath: string): Promise<Session | null>;
}
