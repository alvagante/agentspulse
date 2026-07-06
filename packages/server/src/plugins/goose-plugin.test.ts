import { execFile } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { GoosePlugin } from "./goose-plugin.js";

const execFileAsync = promisify(execFile);

describe("GoosePlugin", () => {
  it("parses sessions from Goose's SQLite database", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-goose-"));
    const dbDir = join(root, "sessions");
    await mkdir(dbDir);
    const dbPath = join(dbDir, "sessions.db");

    await execFileAsync("sqlite3", [dbPath, schemaAndDataSql]);

    const session = await new GoosePlugin().parseSessionFile(dbPath);

    expect(session).toMatchObject({
      id: "session-1",
      toolId: "goose",
      title: "Check services",
      projectPath: "/Users/al/Documents/GITHUB/agentspulse",
      projectName: "agentspulse",
      model: "gpt-5.4",
      tokens: { used: 33, limit: 1050000 },
      messageCount: 2,
      toolCallCount: 1,
      config: {
        model: "gpt-5.4",
        maxTokens: 128000,
        agent: "auto",
      },
    });
    expect(session?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "user_prompt", text: "check services" }),
        expect.objectContaining({ type: "assistant_response", text: "done" }),
        expect.objectContaining({
          type: "tool_call",
          toolName: "shell",
          input: "{\"command\":\"systemctl status\"}",
        }),
      ])
    );
  });
});

const schemaAndDataSql = `
create table sessions (
  id text primary key,
  name text not null default '',
  description text not null default '',
  user_set_name boolean default false,
  session_type text not null default 'user',
  working_dir text not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  extension_data text default '{}',
  total_tokens integer,
  input_tokens integer,
  output_tokens integer,
  accumulated_total_tokens integer,
  accumulated_input_tokens integer,
  accumulated_output_tokens integer,
  schedule_id text,
  recipe_json text,
  user_recipe_values_json text,
  provider_name text,
  model_config_json text,
  goose_mode text not null default 'auto',
  thread_id text
);
create table messages (
  id integer primary key autoincrement,
  message_id text,
  session_id text not null references sessions(id),
  role text not null,
  content_json text not null,
  created_timestamp integer not null,
  timestamp timestamp default current_timestamp,
  tokens integer,
  metadata_json text
);
insert into sessions (
  id, name, description, working_dir, created_at, updated_at,
  total_tokens, input_tokens, output_tokens, accumulated_total_tokens,
  provider_name, model_config_json, goose_mode
) values (
  'session-1', 'Check services', '', '/Users/al/Documents/GITHUB/agentspulse',
  '2026-05-13 05:12:11', '2026-05-13 05:13:11',
  33, 10, 23, null,
  'chatgpt_codex',
  '{"model_name":"gpt-5.4","context_limit":1050000,"max_tokens":128000}',
  'auto'
);
insert into messages (session_id, role, content_json, created_timestamp, tokens, metadata_json)
values
  ('session-1', 'user', '[{"type":"text","text":"check services"}]', 1778649131, 10, '{}'),
  ('session-1', 'assistant', '[{"type":"text","text":"done"},{"type":"toolRequest","toolCall":{"name":"shell","arguments":{"command":"systemctl status"}}}]', 1778649191, 23, '{}');
`;
