import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WindsurfPlugin } from "./windsurf-plugin.js";

describe("WindsurfPlugin", () => {
  it("parses conversation snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-windsurf-"));
    const filePath = join(root, "conversation.json");
    await writeFile(
      filePath,
      JSON.stringify({
        composerId: "windsurf-1",
        title: "Update API route",
        subtitle: "Edited routes.ts",
        createdAt: 1779747057808,
        lastUpdatedAt: 1779747067808,
        unifiedMode: "agent",
        modelConfig: { modelName: "default" },
        totalLinesAdded: 7,
        totalLinesRemoved: 2,
        workspaceIdentifier: {
          uri: { fsPath: "/Users/al/Documents/GITHUB/agentspulse" },
        },
        fullConversationHeadersOnly: [
          { grouping: { hasText: true } },
          { grouping: { hasThinking: true } },
          { grouping: { toolCallId: "tool-1" } },
        ],
      })
    );

    const session = await new WindsurfPlugin().parseSessionFile(filePath);

    expect(session).toMatchObject({
      id: "windsurf-1",
      toolId: "windsurf",
      title: "Update API route",
      status: "done",
      projectPath: "/Users/al/Documents/GITHUB/agentspulse",
      projectName: "agentspulse",
      model: "default",
      messageCount: 2,
      toolCallCount: 1,
      netLines: { additions: 7, deletions: 2 },
    });
  });
});
