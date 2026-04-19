import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * Continue plugin — discovers Continue config and artifacts.
 */
export class ContinuePlugin extends BasePlugin {
  readonly id: ToolId = "continue";
  readonly displayName = "Continue";
  readonly color = "#8a3a6a";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "agents",
    "steering",
  ];
  readonly configDirNames = [".continue"];
  readonly commandNames = ["continue"];
  readonly systemPaths = ["/etc/continue/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.json" },
    { relativePath: "rules.md" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "prompts", category: "agents", isDirectory: true },
    { relativePath: "rules.md", category: "steering", isDirectory: false },
  ];
}
