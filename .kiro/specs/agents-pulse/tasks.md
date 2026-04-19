# Implementation Plan: Agents Pulse

## Overview

Agents Pulse is a local web app that scans the developer's filesystem for AI coding tool data and presents it in a unified dashboard. The implementation follows a bottom-up build order: shared types → core backend (plugin system, scanner, store) → plugin implementations → API layer → frontend scaffolding → frontend pages → property-based tests → integration and polish. The stack is Node.js/TypeScript with Express on the backend and React + Vite on the frontend. Vitest is the test runner; fast-check is used for property-based tests.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize monorepo structure with `packages/server` and `packages/web` directories, root `package.json` with workspaces, and shared `tsconfig.base.json`
    - Create root `package.json` with `workspaces: ["packages/*"]`
    - Create `tsconfig.base.json` with strict mode, ES2022 target, Node module resolution
    - _Requirements: 1.1_

  - [x] 1.2 Set up `packages/server` with TypeScript, Express, Vitest, fast-check, and dev tooling (ts-node-dev)
    - `packages/server/package.json` with dependencies: express, @types/express, typescript, vitest, fast-check, ts-node-dev, supertest
    - `packages/server/tsconfig.json` extending base
    - `packages/server/vitest.config.ts`
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Set up `packages/web` with Vite, React 18, TypeScript, React Router v6, TanStack Query, and testing deps
    - `packages/web/package.json` with dependencies: react, react-dom, react-router-dom, @tanstack/react-query, vite, @vitejs/plugin-react, vitest, @testing-library/react, @testing-library/jest-dom
    - `packages/web/tsconfig.json` extending base
    - `packages/web/vite.config.ts`
    - _Requirements: 1.1_

  - [x] 1.4 Create shared type definitions in `packages/server/src/types.ts`
    - Define all core types: `ToolId`, `SessionStatus`, `ArtifactCategory`, `Session`, `SessionSummary`, `SessionEvent` (union type with `UserPromptEvent`, `AssistantResponseEvent`, `ToolCallEvent`, `FileEditEvent`, `ErrorEvent`), `SessionConfig`, `FileChange`, `Project`, `ProjectSummary`, `GitInfo`, `Dependency`, `ConfigFile`, `ToolArtifact`, `DashboardStats`, `ToolSummary`, `ToolBreakdownEntry`, `ScanResult`, `ScanError`, `ScanScope`, `DetectionResult`, `SessionFilter`, `ArtifactFilter`, `AppConfig`, `FileViewResult`
    - _Requirements: 2.3, 11.1, 12.1, 13.2, 17.1_

  - [x] 1.5 Create constants in `packages/server/src/constants.ts`
    - Define `TOOL_COLORS` map for all 9 tools with hex colors per Requirement 15.1
    - Define `TOOL_DISPLAY_NAMES` map (e.g., `claude` → `"Claude Code"`)
    - Define `TOOL_MARKERS` map (e.g., `claude` → `".claude"`)
    - Define `ARTIFACT_CATEGORY_LABELS` map per Requirement 17.7
    - _Requirements: 15.1, 17.7_

- [x] 2. Core backend — Plugin interface, registry, and scanner infrastructure
  - [x] 2.1 Define the `ToolPlugin` interface in `packages/server/src/plugins/plugin-interface.ts`
    - Interface with: `id`, `displayName`, `color`, `detectionMethod`, `artifactCategories`, `configDirNames`, `commandNames`, `systemPaths`
    - Methods: `detect()`, `discoverConfigs(scope)`, `discoverArtifacts(scope)`, `parseSessions(projectPath)`, `parseSessionFile(filePath)`
    - _Requirements: 2.3, 2.7, 17.1, 17.2_

  - [x] 2.2 Implement `PluginRegistry` in `packages/server/src/plugins/plugin-registry.ts`
    - `register(plugin)`, `getPlugins()`, `getPlugin(id)`, `getDetectedCount()`
    - `autodiscover()` method that checks config dirs (`~/{configDirName}`) and PATH commands (`which`/`where`) for each plugin, sets `detectionMethod` accordingly
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.3 Implement `SessionStore` in `packages/server/src/store/session-store.ts`
    - `update(result)` to replace all data from a ScanResult
    - `getSessions(filter)` with filtering by tool, status, dateRange, search, sorting, and pagination
    - `getSession(id)`, `getProjects()`, `getProject(identifier)`, `getConfigs(scope?)`, `getArtifacts(filter?)`, `getDashboardStats()`, `getLastScanTime()`
    - _Requirements: 3.6, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.4 Write property test: Store round-trip (Property 3)
    - **Property 3: Scan results round-trip through Session Store**
    - Generate random `ScanResult` with fast-check, call `store.update(result)`, query back all sessions/projects/configs/artifacts, verify equivalence to original
    - **Validates: Requirements 3.6**

  - [ ]* 2.5 Write property test: Session filtering (Property 4)
    - **Property 4: Session filtering is correct and complete**
    - Generate random session lists and filter combinations, verify filtered result contains exactly matching sessions
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 2.6 Write property test: Session grouping (Property 5)
    - **Property 5: Session grouping preserves all sessions**
    - Generate random sessions, group by project, verify every session appears exactly once, each group has only sessions from that project, total count matches
    - **Validates: Requirements 5.5, 5.7**

  - [ ]* 2.7 Write property test: Session sorting (Property 6)
    - **Property 6: Session sorting is stable and correct**
    - Generate random sessions and sort params, verify ordering is consistent with sort criteria
    - **Validates: Requirements 5.6**

  - [x] 2.8 Implement `ProjectDetector` in `packages/server/src/scanner/project-detector.ts`
    - `detectProjects(roots)` — walk each root, check for tool marker subdirectories
    - `isProject(dirPath)` — check if directory contains at least one marker
    - `extractGitInfo(projectPath)` — run git commands via `child_process`
    - `extractDependencies(projectPath)` — read and parse `package.json`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ]* 2.9 Write property test: Project detection (Property 12)
    - **Property 12: Project detection identifies directories with tool markers**
    - Generate directories with random subsets of tool marker dirs, verify detection iff at least one marker present, and detected tools list is correct
    - **Validates: Requirements 13.1, 13.2**

  - [ ]* 2.10 Write property test: Package.json dependency extraction (Property 13)
    - **Property 13: Package.json dependency extraction**
    - Generate valid `package.json` with random dependencies/devDependencies, verify extracted list matches
    - **Validates: Requirements 13.3**

  - [x] 2.11 Implement `ConfigViewer` in `packages/server/src/scanner/config-viewer.ts`
    - `readFile(filePath)` returning `FileViewResult` with content, size, lastModified, fileType, readable flag
    - Handle EACCES with `readable: false` and error message
    - _Requirements: 12.2, 12.3_

  - [x] 2.12 Implement `Scanner` in `packages/server/src/scanner/scanner.ts`
    - `fullScan()` — scan user-home, system, and project directories via all registered plugins
    - `scanUserSystem()` — scan only user-home and system configs
    - `scanProject(path)` — scan a single project
    - Handle EACCES by skipping directory with warning, collect errors in `ScanResult.errors`
    - Store results in SessionStore on completion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.13 Write property test: Scanner dispatches to all registered plugins (Property 1)
    - **Property 1: Scanner dispatches to all registered plugins**
    - Register random subsets of mock plugins, invoke scan, verify every registered plugin received a scan call and no unregistered plugin was called
    - **Validates: Requirements 2.2, 2.4, 3.4**

  - [ ]* 2.14 Write property test: Plugin autodiscovery (Property 2)
    - **Property 2: Plugin autodiscovery matches filesystem and PATH state**
    - Generate random filesystem/PATH state per tool, verify autodiscovery detects exactly the correct tools with correct detection methods
    - **Validates: Requirements 2.5, 2.6, 2.7**

- [x] 3. Checkpoint — Core backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Plugin implementations
  - [x] 4.1 Implement Claude Code plugin in `packages/server/src/plugins/claude-plugin.ts`
    - Config dirs: `.claude/`, home: `~/.claude/`, command: `claude`
    - Discover configs: `settings.json`, `CLAUDE.md`, `mcp.json`
    - Discover artifacts: agents/ (agents category), CLAUDE.md (steering)
    - Parse JSONL session files, extract all Session fields per Requirement 11.1
    - _Requirements: 2.1, 2.3, 11.1, 17.1, 17.3_

  - [x] 4.2 Implement Kiro plugin in `packages/server/src/plugins/kiro-plugin.ts`
    - Config dirs: `.kiro/`, home: `~/.kiro/`, command: `kiro`
    - Discover configs: `config.yaml`, steering files, hooks
    - Discover artifacts: specs/ (steering), hooks (hooks), skills (agents)
    - Parse proprietary session format
    - _Requirements: 2.1, 2.3, 11.1, 17.1, 17.3_

  - [x] 4.3 Implement remaining 7 tool plugins (Gemini, OpenCode, Continue, Codex, Cline, OpenClaw, NemoClaw)
    - Each plugin in its own file under `packages/server/src/plugins/`
    - Each implements `ToolPlugin` with correct paths, markers, config discovery, artifact categories
    - Session parsing can use simplified/stub logic initially — correct file discovery is the priority
    - _Requirements: 2.1, 2.3, 17.1_

  - [x] 4.4 Create plugin barrel file `packages/server/src/plugins/index.ts` that instantiates all 9 plugins and exports a `registerAllPlugins(registry)` function
    - _Requirements: 2.1, 2.4_

  - [ ]* 4.5 Write property test: Session parsing extracts all required fields (Property 10)
    - **Property 10: Session parsing extracts all required fields**
    - Generate valid session file content, verify parsing produces Session with all required fields; generate malformed content, verify null returned without throwing
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 4.6 Write property test: Config file metadata extraction (Property 11)
    - **Property 11: Config file metadata extraction matches filesystem**
    - Generate files with known properties, verify extracted ConfigFile has matching path, size, lastModified, fileType, and toolId
    - **Validates: Requirements 12.1**

  - [ ]* 4.7 Write property test: Artifact discovery (Property 15)
    - **Property 15: Artifact discovery covers all declared categories**
    - Generate plugins with declared categories and matching filesystem files, verify scanning returns artifacts for each category with files, and every artifact's category is in the plugin's declared set
    - **Validates: Requirements 17.3, 17.4, 17.5**

- [x] 5. API layer
  - [x] 5.1 Create Express router in `packages/server/src/api/routes.ts` with all REST endpoints
    - `GET /api/dashboard` → DashboardResponse (stats, active sessions, recent projects, tool summaries)
    - `GET /api/sessions` → SessionListResponse (paginated, filterable by tool/status/dateRange/projectId)
    - `GET /api/sessions/:id` → SessionDetailResponse (full session with events, files, config, source paths)
    - `GET /api/projects` → ProjectListResponse
    - `GET /api/projects/:id` → ProjectDetailResponse (project, stats, sessions, tool breakdown, artifacts, git, deps, sparkline)
    - `GET /api/configs` → ConfigListResponse (filterable by scope/fileType/tool)
    - `GET /api/configs/view` → FileViewResponse (query: path)
    - `GET /api/artifacts` → ArtifactListResponse (filterable by tool/category/scope)
    - `GET /api/artifacts/view` → FileViewResponse (query: path)
    - `POST /api/rescan` → RescanResponse
    - `GET /api/tools` → ToolListResponse
    - `GET /api/search` → SearchResponse (query: q)
    - _Requirements: 4.1–4.9, 5.1–5.9, 6.1–6.8, 7.1–7.7, 8.1–8.9, 9.1–9.7, 14.1–14.3_

  - [x] 5.2 Wire API router into Express app in `packages/server/src/index.ts`
    - Connect router to SessionStore, Scanner, ConfigViewer instances
    - Add error handling middleware (400, 404, 500)
    - Serve static SPA files from web build output
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 5.3 Write property test: Session JSON export round-trip (Property 9)
    - **Property 9: Session JSON export round-trip**
    - Generate valid Session objects, export to JSON, parse back, verify equivalence
    - **Validates: Requirements 6.8, 11.3**

  - [ ]* 5.4 Write property test: Config filtering by scope and file type (Property 16)
    - **Property 16: Config filtering by scope and file type**
    - Generate random config file lists and filter combinations, verify filtered result contains exactly matching files
    - **Validates: Requirements 9.6**

  - [ ]* 5.5 Write unit tests for API endpoints
    - Test correct response shapes for each endpoint
    - Test 404 for missing session/project
    - Test rescan returns timing and error info
    - Test export JSON triggers correct content-type
    - _Requirements: 1.3, 14.1–14.3_

- [x] 6. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend scaffolding and shared components
  - [x] 7.1 Create app shell in `packages/web/src/App.tsx` with React Router routes
    - Routes: `/` → DashboardPage, `/sessions` → SessionsPage, `/sessions/:id` → SessionDetailPage, `/projects` → ProjectsPage, `/projects/:id` → ProjectDetailPage, `/user` → UserSystemPage
    - Layout component wrapping all routes
    - _Requirements: 4.1, 10.1_

  - [x] 7.2 Implement NavBar component with persistent top bar
    - Logo mark + "AgentsPulse" text
    - Nav links: Dashboard, Sessions, Projects, User & System with active state highlighting
    - Live session count badge
    - Global search input with Cmd+K / Ctrl+K keyboard shortcut
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 7.3 Set up CSS design tokens and global styles
    - CSS custom properties matching wireframe: `--bg: #fafaf9`, `--panel: #fff`, font families (monospace + sans-serif per Req 15.2, 15.3), colors
    - Light theme per Requirement 15.4
    - Status indicator styles: active=green with pulse animation, done=dark gray, error=red per Requirement 15.5
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 7.4 Implement shared UI components
    - `ToolTag` — colored square + tool name, using TOOL_COLORS constant
    - `StatCard` — large number, label, optional sub-label
    - `Sparkline` — compact bar chart with proportional-height spans (pure CSS)
    - `EmptyState` — dashed-border placeholder with message and guidance text
    - `FilterBar` — chip-based filter row for tool/status/date selection
    - `Timeline` — chronological event list with typed dot indicators
    - `DiffViewer` — unified diff with line numbers, green adds, red deletes
    - `FileTree` — collapsible tree with caret toggles and tool badges
    - `CodeViewer` — preformatted code block with file metadata header
    - `SearchDialog` — modal overlay triggered by Cmd+K
    - _Requirements: 15.1, 15.5, 6.2, 6.7, 9.3, 16.1, 16.2, 16.3_

  - [x] 7.5 Create API client module in `packages/web/src/api/client.ts`
    - Typed fetch functions for all backend endpoints
    - Configure TanStack Query provider with stale time, refetch settings
    - Dashboard auto-refetch every 5 seconds
    - Rescan mutation that invalidates all queries on success
    - _Requirements: 14.2_

  - [ ]* 7.6 Write property test: Tool visual identity mapping (Property 14)
    - **Property 14: Tool visual identity mapping is consistent**
    - For all ToolIds, verify ToolTag uses correct color from TOOL_COLORS; for all SessionStatuses, verify correct indicator color; for all ArtifactCategories, verify correct label from ARTIFACT_CATEGORY_LABELS
    - **Validates: Requirements 15.1, 15.5, 17.7**

- [x] 8. Dashboard page
  - [x] 8.1 Implement DashboardPage component
    - 4 StatCards: active sessions, sessions this week, projects touched, tools detected
    - Active sessions list with title, ToolTag, project path, duration, tokens; links to session detail
    - Empty state "No sessions running" / "Start any agent in a project — it will show here."
    - Recent projects section: top 5 by last activity with name, path, ToolTags, relative time; links to project detail
    - User & system config summary: one card per detected tool with name, home path, file count; link to User & System page
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 16.1_

  - [ ]* 8.2 Write property test: Dashboard top-5 recent projects (Property 17)
    - **Property 17: Dashboard shows correct top-5 recent projects**
    - Generate projects with varying `lastActivityAt`, verify dashboard shows exactly the 5 most recent in descending order (or all if fewer than 5)
    - **Validates: Requirements 4.5**

- [x] 9. Sessions page
  - [x] 9.1 Implement SessionsPage with filter controls and three view modes
    - Filter chips: tool (All + 9 tools), status (Active, Done, Error, Archived), date range (Today, 7d, 30d, All)
    - Grouped by Project view: sessions under project headings with name, count, path
    - Flat Table view: sortable columns (status, title, tool, project, status label, duration, tokens, started), pagination
    - Kanban by Status view: columns for Running, Done, Errored, Archived with session cards
    - View switcher tabs
    - Empty state "No sessions match filters"
    - Click session → navigate to Session Detail
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 16.3_

- [x] 10. Session Detail page
  - [x] 10.1 Implement SessionDetailPage
    - Header: breadcrumbs, title, status chip, ToolTag, model, project path, start timestamp
    - Timeline of all events in chronological order: prompts, responses, tool calls, file edits with line counts, errors
    - DiffViewer for file edit events
    - Metadata sidebar: model, tokens (used/limit), cost, duration, messages, tool calls, files modified, net lines
    - Files modified list with per-file additions (green) and deletions (red)
    - Source file paths on disk
    - Session config display (model, tools, system prompt path)
    - Export JSON action triggering file download
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 10.2 Write property test: Timeline chronological ordering (Property 8)
    - **Property 8: Timeline events are chronologically ordered**
    - Generate events with random timestamps, render Timeline, verify ascending order
    - **Validates: Requirements 6.2**

  - [ ]* 10.3 Write property test: Session detail renders all required metadata (Property 7)
    - **Property 7: Session detail renders all required metadata**
    - Generate valid Session objects, verify all required fields are present in rendered output
    - **Validates: Requirements 6.1, 6.3, 6.4**

- [x] 11. Projects page
  - [x] 11.1 Implement ProjectsPage with three view modes and Rescan
    - Card Grid view: project cards with name, active/idle chip, path, ToolTags, session count, sessions this week, tokens, sparkline, last activity
    - Filesystem Tree view: projects grouped by parent directory in collapsible tree with tool badges and session counts
    - Table with Heatmap view: columns for name, path, tool indicators, 14-day sparkline, sessions, tokens, last activity
    - Rescan button calling POST /api/rescan with loading indicator
    - View switcher tabs
    - Empty state "No projects detected"
    - Click project → navigate to Project Detail
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 14.1, 14.2, 14.3, 16.2_

  - [ ]* 11.2 Write property test: Project filesystem tree grouping (Property 18)
    - **Property 18: Project filesystem tree groups by parent directory**
    - Generate projects with filesystem paths, verify tree groups by common parent, each project appears exactly once under correct parent
    - **Validates: Requirements 7.3**

- [x] 12. Project Detail page
  - [x] 12.1 Implement ProjectDetailPage
    - Header: breadcrumbs, project name, path, git branch/status, runtime/package manager
    - 4 StatCards: total sessions, tools used (with names), total tokens (with cost), net lines by agents
    - 30-day activity sparkline
    - Sessions list: recent sessions with status indicator, title, ToolTag, status label, date; links to session detail
    - Per-tool breakdown: horizontal bar chart proportional to session count with numeric count
    - Config file tree: AI tool directories with contained files
    - Tool artifacts grouped by ArtifactCategory per tool
    - Git activity: branch, last commit message/time, uncommitted count, agent commit ratio (7d)
    - Dependencies from package.json
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 17.5_

- [x] 13. User & System Config page
  - [x] 13.1 Implement UserSystemPage with three view modes and Rescan
    - Grouped by Tool view: one card per tool with ToolTag, home dir path, file count, file list with paths/sizes/view action; artifacts grouped by ArtifactCategory
    - File Tree + Viewer view: collapsible tree on left (grouped by home/system), CodeViewer on right showing file content with path, type, size, last-modified
    - Flat Searchable List view: filterable table (tool, path, type, size, last edited, view action) with filter chips for location (user home, system) and file type (json, yaml/toml, markdown)
    - Rescan button
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 17.4, 17.6_

- [x] 14. Checkpoint — Frontend pages complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration, wiring, and polish
  - [x] 15.1 Wire Express server to serve built SPA static files and configure SPA fallback routing
    - Build web package, copy output to server's static directory
    - Add catch-all route for SPA client-side routing
    - _Requirements: 1.1_

  - [x] 15.2 Implement startup sequence in `packages/server/src/index.ts`
    - Load config from `~/.agentspulse/config.json` (or defaults)
    - Initialize PluginRegistry with autodiscovery
    - Run initial full scan
    - Start Express server, log URL to stdout
    - Handle EADDRINUSE with non-zero exit
    - _Requirements: 1.1, 1.2, 1.3, 2.5, 2.6_

  - [x] 15.3 Add npm scripts for development and production workflows
    - `dev` script for concurrent server + web dev mode
    - `build` script for production build
    - `start` script for production server
    - `test` script running vitest across both packages
    - _Requirements: 1.1_

  - [ ]* 15.4 Write integration tests for full scan pipeline
    - Scanner → PluginRegistry → SessionStore with fixture directories
    - API endpoint tests via Supertest against running server with fixture data
    - Rescan flow: trigger rescan, verify store updates
    - _Requirements: 3.1–3.6, 14.1–14.3_

- [x] 16. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 18 universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout — all code examples and implementations use TypeScript
- fast-check is the PBT library; Vitest is the test runner
