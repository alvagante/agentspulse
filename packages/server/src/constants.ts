import type { ToolId } from "./types.js";

/** Tool brand colors (Requirement 15.1) */
export const TOOL_COLORS: Record<ToolId, string> = {
  claude: "#b8693a",
  kiro: "#3a6b8a",
  gemini: "#6a5a8a",
  opencode: "#3a8a6a",
  continue: "#8a3a6a",
  codex: "#5a5a5a",
  cline: "#8a6a3a",
  openclaw: "#3a3a8a",
  nemoclaw: "#8a3a3a",
};

/** Human-readable display names for each tool */
export const TOOL_DISPLAY_NAMES: Record<ToolId, string> = {
  claude: "Claude Code",
  kiro: "Kiro",
  gemini: "Gemini",
  opencode: "OpenCode",
  continue: "Continue",
  codex: "Codex",
  cline: "Cline",
  openclaw: "OpenClaw",
  nemoclaw: "NemoClaw",
};

/** Marker directory names used to detect tool presence in a project */
export const TOOL_MARKERS: Record<ToolId, string> = {
  claude: ".claude",
  kiro: ".kiro",
  gemini: ".gemini",
  opencode: ".opencode",
  continue: ".continue",
  codex: ".codex",
  cline: ".cline",
  openclaw: ".openclaw",
  nemoclaw: ".nemoclaw",
};

/** Human-readable labels for artifact categories (Requirement 17.7) */
export const ARTIFACT_CATEGORY_LABELS: Record<string, string> = {
  config: "Config Files",
  hooks: "Hooks",
  triggers: "Triggers",
  agents: "Agents",
  mcps: "MCP Servers",
  steering: "Steering / Rules",
  memory: "Memory Files",
};
