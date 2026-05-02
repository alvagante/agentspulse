# Architecture Overview

## High‑Level Diagram

```
+-------------------+        HTTP        +-------------------+
|   Front‑End UI    |  <----------------> |   Backend Server  |
| (React + Vite)   |  (REST API)       | (Node.js/Express)|
+-------------------+                    +-------------------+
          |                                        |
          |                                        |
          v                                        v
+-------------------+                    +-------------------+
|   UI Components   |   Calls API via    |   Plugin System   |
|   (React)         |   fetch/axios      |   (LLM providers)|
+-------------------+                    +-------------------+
          |                                        |
          v                                        v
+-------------------+                    +-------------------+
|  State Management|   Stores session   |   Scanner Service |
|  (React hooks)   |   data in memory   |   (project detection)|
+-------------------+                    +-------------------+
```

## Backend Server (`packages/server`)

- **Framework**: Express.js (lightweight HTTP server)
- **Plugin Architecture**:
  - Each LLM provider (Claude, Gemini, etc.) implements `PluginInterface`.
  - Plugins are discovered via `plugin-registry.ts` and injected into the API.
- **Scanner**:
  - Detects supported project types (e.g., TypeScript, Python) using heuristics in `src/scanner/`.
  - Provides configuration view (`config-viewer.ts`) for UI consumption.
- **Session Store**:
  - In‑memory store (`session-store.ts`) holds temporary session data.
  - Can be swapped for a persistent store in the future.

## Front‑End Application (`packages/web`)

- **Build Tool**: Vite (fast dev server & bundler)
- **UI Library**: React with TypeScript
- **Routing**: Vite’s built‑in file‑system routing (or React Router if added later)
- **Core Components**:
  - `CodeViewer` – syntax‑highlighted code blocks.
  - `DiffViewer` – visual diff of file changes.
  - `FileTree` – navigable project file explorer.
  - `StatCard`, `Sparkline`, `ToolTag` – reusable UI widgets.
- **Pages**:
  - Dashboard, Projects list, Project detail, Sessions list, Session detail, User system.
- **API Client** (`src/api/client.ts`):
  - Centralizes fetch calls, handles base URL, error handling.

## Data Flow

1. UI loads and calls `/api/plugins` to populate available LLM plugins.
2. User selects a plugin and triggers a scan via `/api/scan`.
3. The server scanner analyses the workspace, returns a configuration object.
4. UI displays the configuration using `ConfigViewer` components.
5. User can start a session; the server creates a session entry in the in‑memory store.
6. Throughout the session, UI sends prompts to the selected plugin endpoint and receives responses.

## Extensibility Points

- **Add a New LLM Plugin**:
  1. Create a new file under `src/plugins/` implementing `PluginInterface`.
  2. Register it in `plugin-registry.ts`.
  3. Optionally add UI elements to select the plugin.

- **Persist Sessions**:
  - Replace `SessionStore` with a database‑backed implementation (e.g., SQLite, Postgres).

- **Additional Scanners**:
  - Add new detector modules in `src/scanner/` and expose them via the API.

- **Static Wireframes**:
  - The `wireframe/` folder contains plain HTML prototypes useful for design review. They are not linked to the React app but can be served as fallback static pages.

---

*This architecture document provides a concise map for developers to understand the core components, their responsibilities, and how they interact.*


<task_progress>
- [x] Created PROJECT_OVERVIEW.md
- [x] Created SETUP.md
- [x] Created ARCHITECTURE.md
- [ ] Add CONTRIBUTING.md
- [ ] Add LICENSE file
</task_progress>