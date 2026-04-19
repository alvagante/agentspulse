import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * Cline plugin — discovers Cline config.
 */
export class ClinePlugin extends BasePlugin {
  readonly id: ToolId = "cline";
  readonly displayName = "Cline";
  readonly color = "#8a6a3a";
  readonly artifactCategories: ArtifactCategory[] = ["config"];
  readonly configDirNames = [".cline"];
  readonly commandNames = ["cline"];
  readonly systemPaths = ["/etc/cline/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "settings.json" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [];
}
