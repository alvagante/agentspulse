# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AgentsPulse** is a monitoring and analytics platform for AI assistant tools (Claude, Kiro, Gemini, Continue, Cline, Codex, and others). It scans the local filesystem for AI tool sessions, configs, and artifacts, then serves them via a REST API consumed by a React SPA.

## Commands

```bash
# Development (runs both server + web concurrently)
npm run dev

# Build everything
npm run build

# Start production server
npm run start

# Type check all workspaces
npm run typecheck

# Run all tests
npm run test

# Run tests in a single workspace
npm run test --workspace=packages/server
npm run test --workspace=packages/web

# Run a single test file (from within the package directory)
cd packages/server && npx vitest --run src/scanner/config-viewer.test.ts
```

Server runs on `http://127.0.0.1:4040` by default. Config lives at `~/.agentspulse/config.json`.

## Architecture

NPM workspace monorepo: `packages/server` (Express + Node ESM) and `packages/web` (React + Vite).

### Server (`packages/server/src/`)

**Three-layer design:**

1. **Plugin Layer** — Each AI tool has a plugin class implementing `ToolPlugin` (`plugins/plugin-interface.ts`). Plugins implement `detect()`, `discoverConfigs()`, `discoverArtifacts()`, and `parseSessions()`. Register new tools in `plugins/index.ts → getAllPluginCandidates()`.

2. **Scanner Layer** (`scanner/scanner.ts`) — Orchestrates a `fullScan()` across three scopes (`user-home`, `system`, `project`) by calling each plugin. Results in a `ScanResult` object containing sessions, projects, configs, and artifacts.

3. **Store Layer** (`store/session-store.ts`) — In-memory cache updated on each scan. Provides filtered/paginated query methods consumed by the API.

**API** (`api/routes.ts`): 11 endpoints. Key ones:
- `GET /api/dashboard` — aggregated stats
- `GET /api/sessions` — paginated session list with filters
- `GET /api/sessions/:id` — session with timeline, file diffs, config
- `GET /api/projects/:id` — project with 30-day sparkline
- `POST /api/rescan` — triggers a fresh `fullScan()`
- `GET /api/configs/view`, `GET /api/artifacts/view` — safe file reading via `ConfigViewer`

**`ConfigViewer`** (`scanner/config-viewer.ts`) enforces path safety via `assertSafePath()` (prevents directory traversal). Reads JSON, YAML, TOML, and Markdown.

**Security**: Helmet headers, rate limiting (5 req/min on `/api/rescan`, 200 req/min general), optional API key via `AGENTS_PULSE_API_KEY` env var.

### Web (`packages/web/src/`)

React 18 SPA with React Router v6 (6 routes: `/`, `/sessions`, `/sessions/:id`, `/projects`, `/projects/:id`, `/user`).

**Data fetching**: TanStack Query v5 via custom hooks in `api/client.ts` (`useDashboard()`, `useSessions()`, `useSession()`, etc.). Cache TTL 10 s, 2 retries, no refetch on window focus.

**Key components**: `Timeline`, `DiffViewer`, `FileTree`, `Sparkline`, `FilterBar`, `SearchDialog`.

**Styling**: CSS custom properties (`--text`, `--text-muted`, `--color-kiro`, etc.) — no CSS framework.

## Key Types

All shared types live in `packages/server/src/types.ts`: `Session`, `Project`, `ConfigFile`, `ToolArtifact`, `SessionEvent`, `ScanResult`, `DashboardStats`.

Session status: `"active" | "done" | "error" | "archived"`.  
Session events: `user_prompt | assistant_response | tool_call | file_edit | error`.

## Adding a New AI Tool Plugin

1. Create a class extending `BasePlugin` in `packages/server/src/plugins/`
2. Implement `detect()`, `discoverConfigs()`, `discoverArtifacts()`, `parseSessions()`, `parseSessionFile()`
3. Export and register it in `packages/server/src/plugins/index.ts → getAllPluginCandidates()`

## TypeScript Config

`tsconfig.base.json` at root sets strict mode, `ES2022` target, `NodeNext` module resolution. Both packages extend it. The server compiles to `dist/` via `tsc`; the web bundles via Vite.
