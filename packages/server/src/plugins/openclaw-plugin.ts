import type { ToolId, ArtifactCategory } from "../types.js";
import {
  BasePlugin,
  type ConfigFileEntry,
  type ArtifactEntry,
} from "./base-plugin.js";

/**
 * OpenClaw plugin — discovers OpenClaw config and artifacts.
 */
export class OpenClawPlugin extends BasePlugin {
  readonly id: ToolId = "openclaw";
  readonly displayName = "OpenClaw";
  readonly color = "#3a3a8a";
  readonly artifactCategories: ArtifactCategory[] = [
    "config",
    "agents",
  ];
  readonly configDirNames = [".openclaw"];
  readonly commandNames = ["openclaw"];
  readonly systemPaths = ["/etc/openclaw/"];

  protected readonly configFiles: ConfigFileEntry[] = [
    { relativePath: "config.yaml" },
  ];

  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "profiles", category: "agents", isDirectory: true },
  ];
}
