# AgentsPulse

One dashboard for every AI tool session on your machine. Stop grep-ing through `~/.claude` by hand.

AgentsPulse scans your local filesystem for sessions, configs, and artifacts from Claude, Kiro, Gemini, Continue, Cline, Codex — and anything else you wire up — then exposes them via a REST API and a React SPA.

---

## Architecture

NPM workspace monorepo. Two packages, three layers:

```
packages/
  server/   Express + Node ESM
  web/      React 18 + Vite
```

**Server layers:**
- **Plugin** — one class per AI tool; detects and parses sessions, configs, artifacts
- **Scanner** — orchestrates a full scan across `user-home`, `system`, and `project` scopes
- **Store** — in-memory cache with filtered, paginated query methods

---

## Get Started

```bash
npm install
npm run dev
```

Server starts at `http://127.0.0.1:4040`. Config lives at `~/.agentspulse/config.json`.

---

## Commands

```bash
npm run dev        # server + web, concurrently
npm run build      # compile everything
npm run test       # all tests
npm run typecheck  # tsc across all workspaces
```

---

## API

| Method | Route | What it does |
|--------|-------|--------------|
| `GET` | `/api/dashboard` | Aggregated stats |
| `GET` | `/api/sessions` | Paginated session list, filterable |
| `GET` | `/api/sessions/:id` | Session detail — timeline, file diffs, config |
| `POST` | `/api/rescan` | Trigger a fresh full scan |

---

## Security

- Helmet headers on all responses
- Rate limiting: 200 req/min general, 5 req/min on `/api/rescan`
- Optional API key auth via `AGENTS_PULSE_API_KEY` env var

---

## Adding a Tool Plugin

1. Create a class extending `BasePlugin` in `packages/server/src/plugins/`
2. Implement `detect()`, `discoverConfigs()`, `discoverArtifacts()`, `parseSessions()`
3. Register it in `packages/server/src/plugins/index.ts → getAllPluginCandidates()`

That's it. The scanner picks it up automatically on the next scan.

---

## Supported Tools

Claude · Kiro · Gemini · Continue · Cline · Codex
