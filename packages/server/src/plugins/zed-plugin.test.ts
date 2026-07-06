import { execFile } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ZedPlugin } from "./zed-plugin.js";

const execFileAsync = promisify(execFile);

describe("ZedPlugin", () => {
  it("parses assistant threads from Zed's SQLite database", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-zed-"));
    await mkdir(root, { recursive: true });
    const dbPath = join(root, "threads.db");

    await execFileAsync("sqlite3", [dbPath, schemaAndDataSql]);

    const session = await new ZedPlugin().parseSessionFile(dbPath);

    expect(session).toMatchObject({
      id: "thread-1",
      toolId: "zed",
      title: "Refactor scanner",
      status: "done",
      projectPath: "/Users/al/Documents/GITHUB/agentspulse",
      projectName: "agentspulse",
      model: "unknown",
      messageCount: 1,
      toolCallCount: 0,
      config: {
        model: "unknown",
        agent: "assistant",
      },
    });
  });
});

const schemaAndDataSql = `
create table threads (
  id text primary key,
  summary text not null,
  updated_at text not null,
  data_type text not null,
  data blob not null,
  parent_id text,
  folder_paths text,
  folder_paths_order text,
  created_at text
);
insert into threads (
  id, summary, updated_at, data_type, data, parent_id, folder_paths, folder_paths_order, created_at
) values (
  'thread-1',
  'Refactor scanner',
  '2026-05-17 08:32:37',
  'assistant',
  '{}',
  null,
  '["/Users/al/Documents/GITHUB/agentspulse"]',
  '0',
  '2026-05-17 08:31:37'
);
`;
