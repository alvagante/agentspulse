# Setup Guide

## Prerequisites

- **Node.js** (v18 or later) – download from https://nodejs.org/
- **npm** (comes with Node) or **yarn** if you prefer
- **Git** – for version control
- **macOS** (the repository is tested on macOS but works on Linux/Windows)

## Clone the Repository

```bash
git clone git@github.com:alvagante/agentspulse.git
cd agentspulse
```

## Install Root Dependencies

The monorepo uses a single `package.json` at the repository root to install shared tooling.

```bash
npm install
```

## Install Workspace Packages

The `packages/*` directories are separate npm workspaces. After the root install, they are linked automatically, but you can also run:

```bash
npm run bootstrap   # (if a bootstrap script is added later)
```

## Running the Backend Server

```bash
cd packages/server
npm run dev        # Starts the server in watch mode (usually on http://localhost:3001)
```

The server exposes the following endpoints (see `src/api/routes.ts` for full list):

- `GET /api/plugins` – list available LLM plugins
- `POST /api/scan` – run the project scanner
- `POST /api/session` – create a new session

## Running the Front‑End UI

```bash
cd packages/web
npm run dev        # Starts Vite dev server (usually on http://localhost:5173)
```

The UI automatically talks to the backend at `http://localhost:3001`. Adjust the `API_BASE_URL` in `src/constants.ts` if you run the server on a different port.

## Testing

The server package uses **Vitest**. To run the test suite:

```bash
cd packages/server
npm test
```

## Linting & Formatting

The project uses **ESLint** and **Prettier** (configured in the root). Run them with:

```bash
npm run lint
npm run format
```

## Building for Production

### Server

```bash
cd packages/server
npm run build   # Creates a compiled version in ./dist (if a build script exists)
```

### Web UI

```bash
cd packages/web
npm run build   # Produces static assets in ./dist for deployment
```

## Additional Notes

- The `wireframe/` directory contains static HTML prototypes; they are not part of the production build.
- Plugins are located under `src/plugins/`. To add a new LLM provider, create a new file that implements `PluginInterface` and register it in `plugin-registry.ts`.
- The scanner (`src/scanner/`) can be extended with additional project detection heuristics.

---

*For any issues, refer to the CONTRIBUTING.md file or open an issue on GitHub.*


<task_progress>
- [x] Created PROJECT_OVERVIEW.md
- [x] Created SETUP.md
- [ ] Create ARCHITECTURE.md
- [ ] Add CONTRIBUTING.md
- [ ] Add LICENSE file
</task_progress>