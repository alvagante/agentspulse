import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * OpenCode plugin — discovers OpenCode config and artifacts.
 */
export class OpenCodePlugin extends BasePlugin {
  readonly id: ToolId = "opencode";
  readonly displayName = "OpenCode";
  readonly color = "#3a8a6a";
  readonly artifactCategories: ArtifactCategory[] = ["config", "agents"];
  readonly configDirNames = [".opencode"];
  readonly commandNames = ["opencode"];
  readonly systemPaths = ["/etc/opencode/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "agents", category: "agents", isDirectory: true },
  ];
}
