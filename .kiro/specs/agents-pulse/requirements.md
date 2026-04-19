# Requirements Document

## Introduction

Agents Pulse is a local web application that scans the developer's filesystem for AI coding tool configuration files, session data, and project-level artifacts, then presents them in a unified dashboard interface. The application supports multiple AI tools (Kiro, Claude Code, Gemini, OpenCode, Continue, Codex, Cline, OpenClaw, NemoClaw) through a plugin-based architecture and provides pages for dashboard overview, sessions, session detail, projects, project detail, and user/system configuration browsing.

## Glossary

- **Dashboard**: The index page of the application displaying active sessions, recent projects, user/system config summaries, and aggregate statistics.
- **Scanner**: The component responsible for traversing the filesystem to discover AI tool configuration files, session data, and project artifacts at system, user-home, and project levels.
- **Plugin**: A modular component that encapsulates the knowledge of a specific AI tool's file locations, file formats, and session data structures.
- **Plugin_Registry**: The component that manages the set of available plugins and dispatches scanning and parsing operations to the appropriate plugin.
- **Session**: A single invocation of an AI coding tool within a project, containing prompts, tool calls, edits, errors, and metadata such as model, tokens, cost, and duration.
- **Session_Store**: The component that persists and retrieves parsed session data for display.
- **Project**: A directory on the filesystem where at least one AI coding tool has been invoked, detected by the presence of tool-specific directories (e.g., `.claude/`, `.kiro/`, `.opencode/`).
- **Project_Detector**: The component that identifies project directories by scanning for AI tool marker directories.
- **Config_File**: A configuration, settings, or rules file belonging to an AI coding tool, located at user-home (`~/`), system (`/etc/`), or project level.
- **Config_Viewer**: The component that reads and displays the contents of configuration files.
- **File_Tree**: A hierarchical representation of directories and files used for navigation in the UI.
- **Timeline**: A chronological sequence of events within a session, including prompts, tool calls, edits, and errors.
- **Diff_Viewer**: The component that renders file modifications as added/removed line diffs.
- **Web_Server**: The local HTTP server that serves the Agents Pulse web interface.
- **API_Layer**: The backend component that exposes REST endpoints for the frontend to query scanned data.
- **Frontend**: The browser-based single-page application that renders all pages and views.
- **Tool_Tag**: A visual label identifying which AI tool a session, project, or config file belongs to, rendered with a tool-specific color.
- **Sparkline**: A compact inline chart showing activity over a time period (e.g., sessions per day over 30 days).
- **Stat_Card**: A UI component displaying a single aggregate metric with a label and optional sub-label.
- **Tool_Artifact**: A file or directory belonging to an AI tool that serves a specific function — such as a hook, agent definition, MCP server config, steering document, or memory file.
- **Artifact_Category**: A classification of tool artifacts into functional groups: config, hooks, triggers, agents, mcps, steering, memory.

## Requirements

### Requirement 1: Local Web Server Startup

**User Story:** As a developer, I want to start Agents Pulse as a local web server, so that I can access the dashboard from my browser.

#### Acceptance Criteria

1. WHEN the developer executes the start command, THE Web_Server SHALL bind to a configurable local port and begin serving the Frontend.
2. WHEN the Web_Server starts successfully, THE Web_Server SHALL log the local URL to standard output.
3. IF the configured port is already in use, THEN THE Web_Server SHALL report the port conflict and exit with a non-zero status code.

### Requirement 2: Plugin-Based Tool Architecture

**User Story:** As a developer, I want each AI tool to be supported via a plugin, so that new tools can be added without modifying core application code.

#### Acceptance Criteria

1. THE Plugin_Registry SHALL support registering plugins for Kiro, Claude Code, Gemini, OpenCode, Continue, Codex, Cline, OpenClaw, and NemoClaw.
2. WHEN the Scanner is invoked, THE Plugin_Registry SHALL dispatch scanning to each registered plugin.
3. THE Plugin interface SHALL define methods for: discovering config file paths at user-home, system, and project levels; parsing session data from tool-specific file formats; and extracting session metadata (model, tokens, cost, duration, messages, tool calls, files modified, net lines).
4. WHEN a new plugin is registered with the Plugin_Registry, THE Scanner SHALL include the new plugin in subsequent scans without requiring changes to the Scanner code.
5. WHEN the Plugin_Registry initializes, THE Plugin_Registry SHALL autodiscover plugins by checking for the presence of tool-specific config directories on the filesystem (e.g., `~/.claude/`, `~/.kiro/`).
6. WHEN the Plugin_Registry initializes, THE Plugin_Registry SHALL autodiscover plugins by checking for the presence of tool commands in the system PATH (e.g., `claude`, `kiro`, `gemini`).
7. WHEN a plugin is autodiscovered, THE Plugin SHALL report its detection method as one of: config-based, command-based, or both.

### Requirement 3: Filesystem Scanning

**User Story:** As a developer, I want Agents Pulse to scan my filesystem for AI tool files, so that I can see all my AI tool data in one place.

#### Acceptance Criteria

1. WHEN a scan is triggered, THE Scanner SHALL search the user home directory (`~/`) for AI tool configuration directories (`.claude/`, `.kiro/`, `.gemini/`, `.opencode/`, `.continue/`, `.codex/`, `.cline/`, `.openclaw/`, `.nemoclaw/`).
2. WHEN a scan is triggered, THE Scanner SHALL search system-level paths (`/etc/`) for AI tool configuration files.
3. WHEN a scan is triggered, THE Scanner SHALL search configured project directories for AI tool marker directories.
4. WHEN the Scanner discovers a tool-specific directory, THE Scanner SHALL delegate file parsing to the corresponding plugin via the Plugin_Registry.
5. IF the Scanner encounters a directory it lacks read permissions for, THEN THE Scanner SHALL skip the directory, log a warning, and continue scanning remaining paths.
6. WHEN a scan completes, THE Scanner SHALL store the results in the Session_Store for retrieval by the API_Layer.

### Requirement 4: Dashboard Page

**User Story:** As a developer, I want a dashboard overview page, so that I can see a summary of all AI tool activity on my machine at a glance.

#### Acceptance Criteria

1. WHEN the developer navigates to the root URL, THE Frontend SHALL display the Dashboard page.
2. THE Dashboard SHALL display four Stat_Cards showing: active sessions count, sessions this week count, projects touched count, and tools detected count.
3. WHEN active sessions exist, THE Dashboard SHALL display a list of active sessions showing session title, tool name with Tool_Tag, project path, duration, and token count for each session.
4. WHEN no active sessions exist, THE Dashboard SHALL display an empty state message indicating no sessions are running.
5. THE Dashboard SHALL display a recent projects section listing the five most recently active projects, each showing project name, path, Tool_Tags for detected tools, and time since last activity.
6. THE Dashboard SHALL display a user and system config section showing one card per detected tool with the tool name, home directory path, and file count.
7. WHEN the developer clicks a session entry on the Dashboard, THE Frontend SHALL navigate to the Session Detail page for the selected session.
8. WHEN the developer clicks a project entry on the Dashboard, THE Frontend SHALL navigate to the Project Detail page for the selected project.
9. WHEN the developer clicks the user and system config section link, THE Frontend SHALL navigate to the User and System page.

### Requirement 5: Sessions Page

**User Story:** As a developer, I want to browse all AI agent sessions across tools and projects, so that I can find and review any past or active session.

#### Acceptance Criteria

1. WHEN the developer navigates to the Sessions page, THE Frontend SHALL display all sessions from the Session_Store.
2. THE Sessions page SHALL support filtering sessions by tool name (Kiro, Claude Code, Gemini, OpenCode, Continue, Codex, Cline, OpenClaw, NemoClaw).
3. THE Sessions page SHALL support filtering sessions by status (active, done, error, archived).
4. THE Sessions page SHALL support filtering sessions by date range (today, 7 days, 30 days, all).
5. THE Sessions page SHALL provide a "grouped by project" view that groups sessions under project headings showing project name, session count, and project path.
6. THE Sessions page SHALL provide a "flat table" view displaying all sessions in a sortable table with columns: status indicator, title, tool, project, status label, duration, tokens, and start date.
7. THE Sessions page SHALL provide a "kanban by status" view displaying sessions as cards organized into columns for running, done, errored, and archived statuses.
8. WHEN the developer clicks a session entry, THE Frontend SHALL navigate to the Session Detail page for the selected session.
9. WHEN no sessions match the active filters, THE Frontend SHALL display an empty state message.

### Requirement 6: Session Detail Page

**User Story:** As a developer, I want to view the full details of a single AI agent session, so that I can review what the agent did, what it changed, and how much it cost.

#### Acceptance Criteria

1. WHEN the developer navigates to a Session Detail page, THE Frontend SHALL display the session title, status indicator, tool name with Tool_Tag, model name, project path, and start timestamp in the page header.
2. THE Session Detail page SHALL display a Timeline of all session events in chronological order, including user prompts, assistant responses, tool calls (read, grep, write, edit, bash), file edits with line counts, and errors.
3. THE Session Detail page SHALL display session metadata: model name, total tokens (used and limit), estimated cost, duration, message count, tool call count, files modified count, and net lines changed (additions and deletions).
4. THE Session Detail page SHALL display a list of files modified during the session, each showing the file path and line change counts (additions in green, deletions in red).
5. THE Session Detail page SHALL display the source file paths on disk where the session data is stored.
6. THE Session Detail page SHALL display the configuration used for the session, including model, tools enabled, and system prompt path.
7. WHEN a file edit event is selected in the Timeline, THE Diff_Viewer SHALL render the changes as a unified diff with line numbers, added lines highlighted in green, and removed lines highlighted in red.
8. THE Session Detail page SHALL provide an "Export JSON" action that exports the session data as a JSON file.

### Requirement 7: Projects Page

**User Story:** As a developer, I want to see all directories where AI agents have been invoked, so that I can understand which projects use which tools and how active they are.

#### Acceptance Criteria

1. WHEN the developer navigates to the Projects page, THE Frontend SHALL display all projects detected by the Project_Detector.
2. THE Projects page SHALL provide a "card grid" view displaying each project as a card with: project name, active/idle status indicator, filesystem path, Tool_Tags for each detected tool, session count, sessions this week, total tokens, a Sparkline of recent activity, and time since last activity.
3. THE Projects page SHALL provide a "filesystem tree" view displaying projects organized by their parent directories in a collapsible File_Tree, with each project node showing detected tools and session count.
4. THE Projects page SHALL provide a "table with heatmap" view displaying projects in a table with columns: project name, path, tool indicators, 14-day activity Sparkline, session count, token count, and time since last activity.
5. THE Projects page SHALL provide a "Rescan" button that triggers a new filesystem scan.
6. WHEN the developer clicks a project entry, THE Frontend SHALL navigate to the Project Detail page for the selected project.
7. WHEN no projects are detected, THE Frontend SHALL display an empty state message.

### Requirement 8: Project Detail Page

**User Story:** As a developer, I want to view detailed information about AI tool usage within a specific project, so that I can understand tool activity, configuration, and impact on the codebase.

#### Acceptance Criteria

1. WHEN the developer navigates to a Project Detail page, THE Frontend SHALL display the project name, filesystem path, git branch and status, and detected runtime/package manager in the page header.
2. THE Project Detail page SHALL display four Stat_Cards showing: total sessions, tools used count with tool names, total tokens with estimated cost, and net lines changed by agents.
3. THE Project Detail page SHALL display a 30-day activity Sparkline showing sessions per day.
4. THE Project Detail page SHALL display a sessions list showing the most recent sessions with status indicator, title, Tool_Tag, status label, and date.
5. THE Project Detail page SHALL display a per-tool breakdown showing each tool with a horizontal bar chart proportional to its session count and the numeric session count.
6. THE Project Detail page SHALL display a File_Tree of AI tool configuration directories present in the project (e.g., `.claude/`, `.continue/`, `.opencode/`) with their contained files.
7. THE Project Detail page SHALL display git activity information including current branch, last commit message and time, uncommitted file count, and agent commit ratio over the last 7 days.
8. THE Project Detail page SHALL display project dependencies extracted from the package manifest file (e.g., `package.json`).
9. WHEN the developer clicks a session entry, THE Frontend SHALL navigate to the Session Detail page for the selected session.

### Requirement 9: User and System Config Page

**User Story:** As a developer, I want to browse all AI tool configuration files found at user-home and system level, so that I can review and understand my global AI tool setup.

#### Acceptance Criteria

1. WHEN the developer navigates to the User and System page, THE Frontend SHALL display all config files discovered at user-home (`~/`) and system (`/etc/`) levels.
2. THE User and System page SHALL provide a "grouped by tool" view displaying one card per tool, each showing the Tool_Tag, home directory path, file count, and a list of files with their paths, sizes, and a "view" action.
3. THE User and System page SHALL provide a "file tree + viewer" view with a File_Tree on the left showing all config directories grouped by home and system, and a file content viewer on the right.
4. WHEN the developer selects a file in the File_Tree, THE Config_Viewer SHALL display the file contents with syntax-appropriate formatting, the file path, file type label, file size, and last-modified date.
5. THE User and System page SHALL provide a "flat searchable list" view displaying all config files in a filterable table with columns: tool, path, type, size, last edited date, and a "view" action.
6. THE flat searchable list SHALL support filtering by location (user home, system) and by file type (json, yaml/toml, markdown).
7. THE User and System page SHALL include a "Rescan" action that triggers a new scan of user-home and system-level config paths.

### Requirement 10: Navigation

**User Story:** As a developer, I want consistent navigation across all pages, so that I can move between Dashboard, Sessions, Projects, and User & System pages efficiently.

#### Acceptance Criteria

1. THE Frontend SHALL display a persistent navigation bar on every page with links to Dashboard, Sessions, Projects, and User & System pages.
2. THE navigation bar SHALL visually indicate the currently active page.
3. THE navigation bar SHALL display the application name "AgentsPulse" with a logo mark.
4. THE navigation bar SHALL display a live session count indicator showing the number of currently active sessions.
5. THE Frontend SHALL provide a global search input accessible via keyboard shortcut (Cmd+K or Ctrl+K).

### Requirement 11: Session Data Parsing

**User Story:** As a developer, I want session data parsed from each tool's native format, so that I can view sessions from different tools in a unified interface.

#### Acceptance Criteria

1. WHEN a plugin parses session data, THE Plugin SHALL extract: session identifier, session title or summary, status (active, done, error, archived), start timestamp, duration, model name, token usage, estimated cost, message count, tool call count, list of files modified with line change counts, and the sequence of events (prompts, tool calls, edits, errors) with timestamps.
2. WHEN a plugin encounters a session file it cannot parse, THE Plugin SHALL log a warning with the file path and error description, and skip the file without interrupting the scan.
3. FOR ALL valid session files, parsing then serializing to the internal session format then parsing again SHALL produce an equivalent session object (round-trip property).

### Requirement 12: Config File Parsing

**User Story:** As a developer, I want config files parsed and displayed with their metadata, so that I can review tool configurations without leaving the dashboard.

#### Acceptance Criteria

1. WHEN a plugin discovers a config file, THE Plugin SHALL extract: file path, file size in bytes, last-modified timestamp, file type (json, yaml, toml, markdown, or other), and the owning tool name. Config files are one Artifact_Category of Tool_Artifacts; the same extraction and viewing capabilities apply to all artifact categories.
2. WHEN the Config_Viewer displays a file, THE Config_Viewer SHALL render the raw file contents as a preformatted code block. The Config_Viewer SHALL support displaying any Tool_Artifact regardless of its Artifact_Category.
3. IF a config file or Tool_Artifact cannot be read due to permissions, THEN THE Config_Viewer SHALL display an error message indicating the file is not readable.

### Requirement 13: Project Detection

**User Story:** As a developer, I want projects automatically detected by the presence of AI tool directories, so that I do not need to manually register each project.

#### Acceptance Criteria

1. WHEN the Project_Detector scans a directory, THE Project_Detector SHALL identify the directory as a project if it contains at least one AI tool marker directory (`.claude/`, `.kiro/`, `.opencode/`, `.continue/`, `.codex/`, `.cline/`, `.openclaw/`, `.nemoclaw/`, `.gemini/`).
2. WHEN a project is detected, THE Project_Detector SHALL record: the project directory path, the project name (derived from the directory name), and the list of AI tools detected.
3. WHEN a project contains a `package.json` file, THE Project_Detector SHALL extract the dependency list from the file.
4. WHEN a project is a git repository, THE Project_Detector SHALL extract: current branch name, last commit message and timestamp, count of uncommitted files, and ahead/behind counts.

### Requirement 14: Rescan and Refresh

**User Story:** As a developer, I want to trigger a rescan of the filesystem, so that newly created sessions, projects, and config files appear in the interface.

#### Acceptance Criteria

1. WHEN the developer clicks a "Rescan" button on any page, THE Scanner SHALL perform a full filesystem scan and update the Session_Store with new results.
2. WHEN a rescan completes, THE Frontend SHALL refresh the current page view with the updated data.
3. WHILE a rescan is in progress, THE Frontend SHALL display a loading indicator.

### Requirement 15: Visual Design Consistency

**User Story:** As a developer, I want a clean, readable interface with consistent visual styling, so that the dashboard is easy to scan and use.

#### Acceptance Criteria

1. THE Frontend SHALL render Tool_Tags with tool-specific colors: Claude Code in brown (#b8693a), Kiro in blue (#3a6b8a), Gemini in purple (#6a5a8a), OpenCode in teal (#3a8a6a), Continue in magenta (#8a3a6a), Codex in gray (#5a5a5a), Cline in amber (#8a6a3a), OpenClaw in indigo (#3a3a8a), and NemoClaw in red (#8a3a3a).
2. THE Frontend SHALL use a monospace font family (ui-monospace, SF Mono, JetBrains Mono, Menlo, Consolas) for file paths, code blocks, timestamps, and numeric data.
3. THE Frontend SHALL use a sans-serif font family (Inter, system fonts) for body text, headings, and labels.
4. THE Frontend SHALL use a light theme with a background color of #fafaf9 and panel color of #fff.
5. THE Frontend SHALL render session status indicators as colored dots: active sessions in green (#2f6b3a) with a pulse animation, idle sessions in gray, done sessions in dark gray, and errored sessions in red (#8a2a2a).

### Requirement 16: Empty States

**User Story:** As a developer, I want meaningful empty state messages when no data is available, so that I understand why a section is blank and what action to take.

#### Acceptance Criteria

1. WHEN the Dashboard has no active sessions, THE Frontend SHALL display "No sessions running" with guidance text "Start any agent in a project — it will show here."
2. WHEN the Projects page has no detected projects, THE Frontend SHALL display "No projects detected."
3. WHEN the Sessions page filters produce no matching results, THE Frontend SHALL display "No sessions match filters."

### Requirement 17: Tool Artifact Browsing

**User Story:** As a developer, I want to browse all artifacts (hooks, agents, MCP configs, steering docs, memory files, etc.) belonging to each AI tool, so that I can understand the full scope of each tool's presence on my system and within my projects.

#### Acceptance Criteria

1. THE Plugin interface SHALL declare the Artifact_Categories it supports from a common set: config, hooks, triggers, agents, mcps, steering, and memory.
2. WHERE a plugin supports artifact categories beyond the common set, THE Plugin SHALL declare those additional categories as plugin-specific Artifact_Categories.
3. WHEN a scan completes, THE Plugin SHALL discover and report all Tool_Artifacts for each declared Artifact_Category.
4. WHEN the developer navigates to the User and System page, THE Frontend SHALL display discovered Tool_Artifacts grouped by Artifact_Category for each tool.
5. WHEN the developer navigates to a Project Detail page, THE Frontend SHALL display discovered Tool_Artifacts grouped by Artifact_Category for each tool detected in the project.
6. WHEN the developer selects a Tool_Artifact, THE Config_Viewer SHALL display the artifact file contents with the file path, Artifact_Category label, file size, and last-modified date.
7. THE Frontend SHALL display Artifact_Category labels using human-readable names: "Config Files", "Hooks", "Triggers", "Agents", "MCP Servers", "Steering / Rules", and "Memory Files".
