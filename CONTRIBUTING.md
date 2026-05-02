# Contributing to AgentsPulse

We welcome contributions! This guide will help you get started quickly.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Style Guidelines](#style-guidelines)
- [License](#license)

## Code of Conduct

Please read and follow our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) (if present). We expect a friendly, welcoming environment for everyone.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork**:

   ```bash
   git clone git@github.com:<your-username>/agentspulse.git
   cd agentspulse
   ```

3. **Install dependencies** (see `docs/SETUP.md` for full details):

   ```bash
   npm install
   ```

4. **Run the development servers**:

   ```bash
   # Terminal 1 – backend
   cd packages/server && npm run dev

   # Terminal 2 – frontend
   cd packages/web && npm run dev
   ```

   The UI should be reachable at `http://localhost:5173` and will proxy API calls to `http://localhost:3001`.

## Development Workflow

1. **Create a new branch** for your feature or bug fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** in the appropriate package (`server` or `web`). Keep changes scoped to the relevant workspace.

3. **Run lint & format** to ensure code quality:

   ```bash
   npm run lint
   npm run format
   ```

4. **Add tests** if you are adding new functionality (see the Testing section).

5. **Commit** with a clear message following the Conventional Commits style:

   ```
   feat(plugin): add new OpenAI plugin
   fix(scanner): correct path detection for .gitignore
   docs: update setup guide
   ```

6. **Push** your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

- **Server tests** use Vitest. Run them with:

  ```bash
  cd packages/server
  npm test
  ```

- The front‑end currently does not have a test suite, but you can run the TypeScript compiler to catch type errors:

  ```bash
  cd packages/web
  npx tsc --noEmit
  ```

## Submitting a Pull Request

1. Ensure the CI pipeline passes (`npm test`, lint, format).
2. Open a PR against the `main` branch of the original repository.
3. Fill out the PR template (include description, related issue, screenshots if UI changes).
4. Request review from maintainers.

## Style Guidelines

- **TypeScript**: Strict mode enabled (`tsconfig.base.json`).
- **React**: Use functional components and hooks; avoid class components.
- **ESLint**: Follow the rules defined in `.eslintrc` (if present). Run `npm run lint` before committing.
- **Prettier**: Auto‑formatting is enforced. Run `npm run format` to fix style issues.

## License

By contributing, you agree that your contributions will be licensed under the same MIT License as the project.

---

Thank you for your interest in improving AgentsPulse! 🎉


<task_progress>
- [x] Created PROJECT_OVERVIEW.md
- [x] Created SETUP.md
- [x] Created ARCHITECTURE.md
- [x] Created CONTRIBUTING.md
- [ ] Add LICENSE file
</task_progress>