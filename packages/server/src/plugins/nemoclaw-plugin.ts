import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * NemoClaw plugin — discovers NemoClaw config.
 */
export class NemoClawPlugin extends BasePlugin {
  readonly id: ToolId = "nemoclaw";
  readonly displayName = "NemoClaw";
  readonly color = "#8a3a3a";
  readonly artifactCategories: ArtifactCategory[] = ["config"];
  readonly configDirNames = [".nemoclaw"];
  readonly commandNames = ["nemoclaw"];
  readonly systemPaths = ["/etc/nemoclaw/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [];
}
