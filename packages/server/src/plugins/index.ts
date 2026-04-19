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
};

/** Returns all 9 plugin instances for autodiscovery */
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
  ];
}

/** Instantiates all 9 plugins and registers them with the registry */
export function registerAllPlugins(registry: PluginRegistry): void {
  const plugins = getAllPluginCandidates();
  for (const plugin of plugins) {
    registry.register(plugin);
  }
}
