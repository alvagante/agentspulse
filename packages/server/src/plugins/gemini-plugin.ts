import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * Gemini plugin — discovers Gemini config and artifacts.
 */
export class GeminiPlugin extends BasePlugin {
  readonly id: ToolId = "gemini";
  readonly displayName = "Gemini";
  readonly color = "#6a5a8a";
  readonly artifactCategories: ArtifactCategory[] = ["config", "steering"];
  readonly configDirNames = [".gemini"];
  readonly commandNames = ["gemini"];
  readonly systemPaths = ["/etc/gemini/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
    { relativePath: "GEMINI.md" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "GEMINI.md", category: "steering", isDirectory: false },
  ];
}
