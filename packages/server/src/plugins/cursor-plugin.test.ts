import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CursorPlugin } from "./cursor-plugin.js";

describe("CursorPlugin", () => {
  it("parses composer data snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-cursor-"));
    const filePath = join(root, "composer.json");
    await writeFile(
      filePath,
      JSON.stringify({
        composerId: "composer-1",
        name: "Fix auth flow",
        subtitle: "Read auth.ts",
        createdAt: 1779747057808,
        lastUpdatedAt: 1779747067808,
        unifiedMode: "agent",
        status: "completed",
        modelConfig: { model: "claude-4-sonnet" },
        totalLinesAdded: 12,
        totalLinesRemoved: 3,
        workspaceIdentifier: {
          uri: { fsPath: "/Users/al/Documents/GITHUB/agentspulse" },
        },
        fullConversationHeadersOnly: [
          { type: 1, grouping: { hasText: true } },
          { type: 2, grouping: { hasThinking: true } },
          { type: 2, grouping: { toolCallId: "tool-1" } },
        ],
      })
    );

    const session = await new CursorPlugin().parseSessionFile(filePath);

    expect(session).toMatchObject({
      id: "composer-1",
      toolId: "cursor",
      title: "Fix auth flow",
      status: "done",
      projectPath: "/Users/al/Documents/GITHUB/agentspulse",
      projectName: "agentspulse",
      model: "claude-4-sonnet",
      messageCount: 2,
      toolCallCount: 1,
      netLines: { additions: 12, deletions: 3 },
      config: {
        model: "claude-4-sonnet",
        agent: "agent",
      },
    });
  });
});
