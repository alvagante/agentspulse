# Project Overview

## Repository Structure

```
agentspulse/
├─ .gitignore
├─ CLAUDE.md
├─ package.json
├─ package-lock.json
├─ README.md
├─ tsconfig.base.json
├─ packages/
│  ├─ server/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vitest.config.ts
│  │  └─ src/
│  │     ├─ constants.ts
│  │     ├─ index.ts
│  │     ├─ types.ts
│  │     ├─ api/
│  │     │  └─ routes.ts
│  │     ├─ plugins/
│  │     │  ├─ base-plugin.ts
│  │     │  ├─ claude-plugin.ts
│  │     │  ├─ cline-plugin.ts
│  │     │  ├─ codex-plugin.ts
│  │     │  ├─ continue-plugin.ts
│  │     │  ├─ gemini-plugin.ts
│  │     │  ├─ index.ts
│  │     │  ├─ kiro-plugin.ts
│  │     │  ├─ nemoclaw-plugin.ts
│  │     │  ├─ openclaw-plugin.ts
│  │     │  ├─ opencode-plugin.ts
│  │     │  ├─ plugin-interface.ts
│  │     │  └─ plugin-registry.ts
│  │     ├─ scanner/
│  │     │  ├─ config-viewer.test.ts
│  │     │  ├─ config-viewer.ts
│  │     │  ├─ project-detector.ts
│  │     │  └─ scanner.ts
│  │     └─ store/
│  │        └─ session-store.ts
│  └─ web/
│     ├─ index.html
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ vite.config.ts
│     └─ src/
│        ├─ App.tsx
│        ├─ constants.ts
│        ├─ index.css
│        ├─ main.tsx
│        ├─ types.ts
│        ├─ utils.ts
│        ├─ api/
│        │   └─ client.ts
│        └─ components/
│            ├─ CodeViewer.tsx
│            ├─ DiffViewer.tsx
│            ├─ EmptyState.tsx
│            ├─ FileTree.tsx
│            ├─ FilterBar.tsx
│            ├─ NavBar.tsx
│            ├─ SearchDialog.tsx
│            ├─ Sparkline.tsx
│            ├─ StatCard.tsx
│            └─ Timeline.tsx
│            └─ ToolTag.tsx
│        └─ pages/
│            ├─ DashboardPage.tsx
│            ├─ ProjectDetailPage.tsx
│            ├─ ProjectsPage.tsx
│            ├─ SessionDetailPage.tsx
│            ├─ SessionsPage.tsx
│            └─ UserSystemPage.tsx
└─ wireframe/
   ├─ index.html
   ├─ project-detail.html
   ├─ projects.html
   ├─ session-detail.html
   ├─ sessions.html
   ├─ shared.js
   ├─ styles.css
   └─ user.html
```

## Packages

### `packages/server`

- **Purpose**: Implements the backend API for AgentsPulse. It provides plugin infrastructure to integrate with various LLM providers (Claude, Gemini, etc.) and offers scanning utilities for project detection.
- **Key Modules**
  - `src/api/routes.ts` – Express routes exposing the API.
  - `src/plugins/*` – Individual plugin implementations for different LLM services.
  - `src/scanner/*` – Logic for detecting projects and extracting configuration.
  - `src/store/session-store.ts` – In‑memory session persistence.

### `packages/web`

- **Purpose**: Front‑end application built with React + Vite. It visualises sessions, projects, and provides UI components for interacting with the server.
- **Key Modules**
  - `src/App.tsx` – Root React component.
  - `src/components/*` – Reusable UI widgets (code viewer, diff viewer, navigation, etc.).
  - `src/pages/*` – Page‑level components for routing (dashboard, project detail, etc.).
  - `src/api/client.ts` – Thin wrapper around fetch to call the server API.

### `wireframe`

- Simple static HTML mock‑ups used for early design discussions. They are not part of the production build but illustrate intended layouts.

## Build & Run

1. **Install dependencies** (root workspace):
   ```bash
   npm install
   ```

2. **Develop server**:
   ```bash
   cd packages/server && npm run dev
   ```

3. **Develop web UI**:
   ```bash
   cd packages/web && npm run dev
   ```

4. **Run tests** (server):
   ```bash
   cd packages/server && npm test
   ```

## Important Files

- `README.md` – High‑level description of the repository.
- `tsconfig.base.json` – Shared TypeScript configuration.
- `packages/server/vitest.config.ts` – Test runner configuration for the server.
- `packages/web/vite.config.ts` – Vite bundler configuration for the web UI.

---

*This document was generated automatically to give developers a quick overview of the project layout and purpose of each component.*


<task_progress>
- [x] Created task progress checklist
- [x] Added PROJECT_OVERVIEW.md with repository analysis
- [ ] Create additional documentation files (SETUP, ARCHITECTURE)
- [ ] Add CONTRIBUTING.md
- [ ] Add LICENSE file
</task_progress>