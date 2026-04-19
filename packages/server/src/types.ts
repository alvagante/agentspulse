// ============================================================
// Core Types — Agents Pulse
// ============================================================

/** Tool identifiers — one per supported AI tool */
export type ToolId =
  | "kiro"
  | "claude"
  | "gemini"
  | "opencode"
  | "continue"
  | "codex"
  | "cline"
  | "openclaw"
  | "nemoclaw";

/** Session lifecycle status */
export type SessionStatus = "active" | "done" | "error" | "archived";

/** Artifact categories — common set plus plugin-extensible */
export type ArtifactCategory =
  | "config"
  | "hooks"
  | "triggers"
  | "agents"
  | "mcps"
  | "steering"
  | "memory"
  | (string & {}); // plugin-specific categories

// ============================================================
// Session
// ============================================================

export interface Session {
  id: string;
  toolId: ToolId;
  title: string;
  status: SessionStatus;
  projectPath: string;
  projectName: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs: number;
  model: string;
  tokens: {
    used: number;
    limit: number;
  };
  estimatedCost: number;
  messageCount: number;
  toolCallCount: number;
  filesModified: FileChange[];
  netLines: {
    additions: number;
    deletions: number;
  };
  events: SessionEvent[];
  sourceFiles: string[];
  config: SessionConfig;
}

export interface SessionSummary {
  id: string;
  toolId: ToolId;
  title: string;
  status: SessionStatus;
  projectPath: string;
  projectName: string;
  startedAt: Date;
  durationMs: number;
  tokens: number;
  lastPrompt?: string;
}

export interface SessionConfig {
  model: string;
  maxTokens?: number;
  tools: string[];
  systemPrompt?: string;
  agent?: string;
  mcpServers?: string[];
}

// ============================================================
// Session Events (Timeline)
// ============================================================

export type SessionEvent =
  | UserPromptEvent
  | AssistantResponseEvent
  | ToolCallEvent
  | FileEditEvent
  | ErrorEvent;

export interface BaseEvent {
  timestamp: Date;
  type: string;
}

export interface UserPromptEvent extends BaseEvent {
  type: "user_prompt";
  text: string;
}

export interface AssistantResponseEvent extends BaseEvent {
  type: "assistant_response";
  text: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool_call";
  toolName: string;
  input: string;
  output?: string;
  success: boolean;
}

export interface FileEditEvent extends BaseEvent {
  type: "file_edit";
  filePath: string;
  additions: number;
  deletions: number;
  isNewFile: boolean;
  diff?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  message: string;
  details?: string;
}

// ============================================================
// File Change
// ============================================================

export interface FileChange {
  filePath: string;
  additions: number;
  deletions: number;
  isNewFile: boolean;
}

// ============================================================
// Project
// ============================================================

export interface Project {
  id: string;
  name: string;
  path: string;
  tools: ToolId[];
  sessionCount: number;
  sessionsThisWeek: number;
  totalTokens: number;
  estimatedCost: number;
  netLines: {
    additions: number;
    deletions: number;
  };
  lastActivityAt: Date;
  isActive: boolean;
  activitySparkline: number[];
  gitInfo: GitInfo | null;
  dependencies: Dependency[];
  artifacts: ToolArtifact[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  tools: ToolId[];
  sessionCount: number;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface GitInfo {
  branch: string;
  lastCommitMessage: string;
  lastCommitAt: Date;
  uncommittedCount: number;
  ahead: number;
  behind: number;
}

export interface Dependency {
  name: string;
  version: string;
}

// ============================================================
// Config File
// ============================================================

export interface ConfigFile {
  path: string;
  toolId: ToolId | "shared";
  scope: "user-home" | "system" | "project";
  fileType: "json" | "yaml" | "toml" | "markdown" | "other";
  size: number;
  lastModified: Date;
}

// ============================================================
// Tool Artifact
// ============================================================

export interface ToolArtifact {
  path: string;
  toolId: ToolId;
  category: ArtifactCategory;
  scope: "user-home" | "system" | "project";
  projectPath?: string;
  fileType: "json" | "yaml" | "toml" | "markdown" | "other";
  size: number;
  lastModified: Date;
}

// ============================================================
// Dashboard Stats
// ============================================================

export interface DashboardStats {
  activeSessions: number;
  sessionsThisWeek: number;
  projectsTouched: number;
  toolsDetected: number;
}

export interface ToolSummary {
  toolId: ToolId;
  displayName: string;
  color: string;
  homePath: string;
  fileCount: number;
  detectionMethod: "config" | "command" | "both";
}

export interface ToolBreakdownEntry {
  toolId: ToolId;
  displayName: string;
  sessionCount: number;
  proportion: number;
}

// ============================================================
// Scan Result & Error
// ============================================================

export interface ScanResult {
  sessions: Session[];
  projects: Project[];
  configs: ConfigFile[];
  artifacts: ToolArtifact[];
  errors: ScanError[];
  scannedAt: Date;
  durationMs: number;
}

export interface ScanError {
  path: string;
  pluginId?: ToolId;
  message: string;
  code: "EACCES" | "ENOENT" | "PARSE_ERROR" | "UNKNOWN";
}

export interface ScanScope {
  level: "user-home" | "system" | "project";
  basePath: string;
}

// ============================================================
// Detection Result
// ============================================================

export interface DetectionResult {
  detected: boolean;
  method: "config" | "command" | "both" | "none";
  configPaths: string[];
  commandPath?: string;
}

// ============================================================
// Filters
// ============================================================

export interface SessionFilter {
  tool?: ToolId;
  status?: SessionStatus;
  dateRange?: "today" | "7d" | "30d" | "all";
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "startedAt" | "title" | "tokens" | "duration";
  sortOrder?: "asc" | "desc";
}

export interface ArtifactFilter {
  tool?: ToolId;
  category?: ArtifactCategory;
  scope?: "user-home" | "system" | "project";
  projectPath?: string;
}

// ============================================================
// Application Config
// ============================================================

export interface AppConfig {
  port: number;
  host: string;
  projectRoots: string[];
  scanIntervalMs: number;
  configPath: string;
}

// ============================================================
// File View Result
// ============================================================

export interface FileViewResult {
  path: string;
  content: string;
  size: number;
  lastModified: Date;
  fileType: "json" | "yaml" | "toml" | "markdown" | "other";
  readable: boolean;
  error?: string;
}

// ============================================================
// Project Stats (for Project Detail API response)
// ============================================================

export interface ProjectStats {
  totalSessions: number;
  toolsUsed: ToolId[];
  totalTokens: number;
  estimatedCost: number;
  netLines: {
    additions: number;
    deletions: number;
  };
}
