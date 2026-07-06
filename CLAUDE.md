<!-- BEGIN swamp managed section - DO NOT EDIT -->
# Project

This repository is managed with [swamp](https://github.com/systeminit/swamp).

## Rules

1. **Search before you build.** When automating AWS, APIs, or any external service: (a) search local types with `swamp model type search <query>`, (b) search community extensions with `swamp extension search <query>`, (c) if a community extension exists, install it with `swamp extension pull <package>` instead of building from scratch, (d) only create a custom extension model in `extensions/models/` if nothing exists. Use the `swamp-extension` skill for guidance. The `command/shell` model is ONLY for ad-hoc one-off shell commands, NEVER for wrapping CLI tools or building integrations.
2. **Extend, don't be clever.** When a model covers the domain but lacks the method you need, extend it with `export const extension` — don't bypass it with shell scripts, CLI tools, or multi-step hacks. One method, one purpose. Use `swamp model type describe <type> --json` to check available methods.
3. **Use the data model.** Once data exists in a model (via `lookup`, `start`, `sync`, etc.), reference it with CEL expressions. Don't re-fetch data that's already available.
4. **CEL expressions everywhere.** Wire models together with CEL expressions. Always prefer `data.latest("<name>", "<dataName>").attributes.<field>` over the deprecated `model.<name>.resource.<spec>.<instance>.attributes.<field>` pattern.
5. **Verify before destructive operations.** Always `swamp model get <name> --json` and verify resource IDs before running delete/stop/destroy methods.
6. **Prefer fan-out methods over loops.** When operating on multiple targets, use a single method that handles all targets internally (factory pattern) rather than looping N separate `swamp model method run` calls against the same model. Multiple parallel calls against the same model contend on the per-model lock, causing timeouts. A single fan-out method acquires the lock once and produces all outputs in one execution. Check `swamp model type describe` for methods that accept filters or produce multiple outputs.
7. **Extension npm deps are bundled, not lockfile-tracked.** Swamp's bundler inlines all npm packages (except zod) into extension bundles at bundle time. `deno.lock` and `package.json` do NOT cover extension model dependencies — this is by design. Always pin explicit versions in `npm:` import specifiers (e.g., `npm:lodash-es@4.17.21`).
8. **Reports for reusable data pipelines.** When the task involves building a repeatable pipeline to transform, aggregate, or analyze model output (security reports, cost analysis, compliance checks, summaries), create a report extension. Use the `swamp-report` skill for guidance.

## Skills

**IMPORTANT:** Always load swamp skills, even when in plan mode. The skills provide
essential context for working with this repository.

- `swamp-getting-started` - Interactive onboarding for new swamp users
- `swamp-model` - Work with swamp models (creating, editing, validating)
- `swamp-workflow` - Work with workflows (creating, editing, running)
- `swamp-vault` - Manage secrets and credentials
- `swamp-data` - Manage model data lifecycle and query with CEL
- `swamp-report` - Run and configure reports for models and workflows
- `swamp-repo` - Repository management
- `swamp-extension` - Create custom extensions (models, vaults, drivers, datastores, reports)
- `swamp-extension-publish` - Publish extensions to the registry
- `swamp-issue` - Submit bug reports and feature requests
- `swamp-troubleshooting` - Diagnose swamp problems and verify swamp's health

## Getting Started

**IMPORTANT:** At the start of every conversation, run
`swamp model search --json`. If no models are returned (empty result), you MUST
immediately invoke the `swamp-getting-started` skill before doing anything else.
This walks new users through an interactive onboarding tutorial.

If models already exist, start by using the `swamp-model` skill to work with
swamp models.

## Commands

Use `swamp --help` to see available commands. For a machine-readable JSON
schema of the CLI (commands, options, arguments) intended for agent
consumption, run `swamp help [<command>...]` — e.g. `swamp help` returns
the full tree, and `swamp help model method run` scopes to a subtree.
<!-- END swamp managed section -->

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
