import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DevinPlugin } from "./devin-plugin.js";

describe("DevinPlugin", () => {
  it("parses JSONL sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-devin-"));
    const filePath = join(root, "session.jsonl");
    await writeFile(
      filePath,
      [
        JSON.stringify({
          type: "metadata",
          id: "devin-1",
          title: "Investigate deploy",
          projectPath: "/Users/al/Documents/GITHUB/agentspulse",
          createdAt: "2026-05-17T08:31:37.000Z",
          updatedAt: "2026-05-17T08:32:37.000Z",
          model: "devin",
          status: "completed",
        }),
        JSON.stringify({
          role: "user",
          timestamp: "2026-05-17T08:31:40.000Z",
          content: "check deploy",
        }),
        JSON.stringify({
          role: "assistant",
          timestamp: "2026-05-17T08:32:00.000Z",
          content: "done",
        }),
        JSON.stringify({
          type: "tool_call",
          timestamp: "2026-05-17T08:32:10.000Z",
          toolName: "shell",
          input: { command: "npm run build" },
        }),
      ].join("\n")
    );

    const session = await new DevinPlugin().parseSessionFile(filePath);

    expect(session).toMatchObject({
      id: "devin-1",
      toolId: "devin",
      title: "Investigate deploy",
      status: "done",
      projectPath: "/Users/al/Documents/GITHUB/agentspulse",
      projectName: "agentspulse",
      model: "devin",
      messageCount: 2,
      toolCallCount: 1,
    });
  });
});
