import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * Codex plugin — discovers Codex config and artifacts.
 */
export class CodexPlugin extends BasePlugin {
  readonly id: ToolId = "codex";
  readonly displayName = "Codex";
  readonly color = "#5a5a5a";
  readonly artifactCategories: ArtifactCategory[] = ["config", "steering"];
  readonly configDirNames = [".codex"];
  readonly commandNames = ["codex"];
  readonly systemPaths = ["/etc/codex/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.toml" },
    { relativePath: "instructions.md" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "instructions.md", category: "steering", isDirectory: false },
  ];
}
