import type { ToolPlugin } from "./plugin-interface.js";
import type { PluginRegistry } from "./plugin-registry.js";
import { ClaudePlugin } from "./claude-plugin.js";
import { KiroPlugin } from "./kiro-plugin.js";
import { GeminiPlugin } from "./gemini-plugin.js";
import { OpenCodePlugin } from "./opencode-plugin.js";
import { ContinuePlugin } from "./continue-plugin.js";
import { CodexPlugin } from "./codex-plugin.js";
import { ClinePlugin } from "./cline-plugin.js";
import { OpenClawPlugin } from "./openclaw-plugin.js";
import { NemoClawPlugin } from "./nemoclaw-plugin.js";
import { CursorPlugin } from "./cursor-plugin.js";
import { GoosePlugin } from "./goose-plugin.js";

export {
  ClaudePlugin,
  KiroPlugin,
  GeminiPlugin,
  OpenCodePlugin,
  ContinuePlugin,
  CodexPlugin,
  ClinePlugin,
  OpenClawPlugin,
  NemoClawPlugin,
  CursorPlugin,
  GoosePlugin,
};

/** Returns all plugin instances for autodiscovery */
export function getAllPluginCandidates(): ToolPlugin[] {
  return [
    new ClaudePlugin(),
    new KiroPlugin(),
    new GeminiPlugin(),
    new OpenCodePlugin(),
    new ContinuePlugin(),
    new CodexPlugin(),
    new ClinePlugin(),
    new OpenClawPlugin(),
    new NemoClawPlugin(),
    new CursorPlugin(),
    new GoosePlugin(),
  ];
}

/** Instantiates all plugins and registers them with the registry */
export function registerAllPlugins(registry: PluginRegistry): void {
  const plugins = getAllPluginCandidates();
  for (const plugin of plugins) {
    registry.register(plugin);
  }
}
