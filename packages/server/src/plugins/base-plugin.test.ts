import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BasePlugin, type ArtifactEntry, type ConfigFileEntry } from "./base-plugin.js";
import type { ArtifactCategory, ToolId } from "../types.js";

class TestPlugin extends BasePlugin {
  readonly id: ToolId = "codex";
  readonly displayName = "Test";
  readonly color = "#000";
  readonly artifactCategories: ArtifactCategory[] = ["agents"];
  readonly configDirNames = [".test-tool"];
  readonly commandNames: string[] = [];
  readonly systemPaths: string[] = [];

  protected readonly configFiles: ConfigFileEntry[] = [];
  protected readonly artifactEntries: ArtifactEntry[] = [
    { relativePath: "agents", category: "agents", isDirectory: true },
  ];
}

describe("BasePlugin artifact discovery", () => {
  it("includes symlinked files inside artifact directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-plugin-"));
    const toolDir = join(root, ".test-tool");
    const agentsDir = join(toolDir, "agents");
    const targetDir = join(root, "target");
    await mkdir(agentsDir, { recursive: true });
    await mkdir(targetDir);

    const target = join(targetDir, "agent.md");
    const link = join(agentsDir, "agent.md");
    await writeFile(target, "# Agent\n");
    await symlink(target, link);

    const artifacts = await new TestPlugin().discoverArtifacts({
      level: "user-home",
      basePath: root,
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      path: link,
      toolId: "codex",
      category: "agents",
      scope: "user-home",
      fileType: "markdown",
      size: 8,
    });
  });
});
