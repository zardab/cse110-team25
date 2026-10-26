# CSE 110 - Team 25

React + TypeScript + Vite project with automated testing (Vitest + React Testing Library) and GitHub Actions CI.

## Prerequisites

- Node.js (v22+) & npm

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Run unit tests:**
   ```bash
   npm test          # Single run (CI mode)
   npm run test:watch # Watch mode
   ```

4. **Run linter & production build:**
   ```bash
   npm run lint
   npm run build
   ```

## Continuous Integration (CI)

GitHub Actions workflow (`.github/workflows/ci.yml`) automatically runs on pushes and pull requests to `main`:
- Installs dependencies via `npm ci`
- Checks code quality with ESLint (`npm run lint`)
- Runs unit tests with Vitest (`npm test`)
- Verifies TypeScript compilation and Vite production bundle (`npm run build`)

## Architecture and Track Guides

- [Implementation contract](docs/implementation-contract.md): shared data model, evaluator and store boundaries, mode behavior, and integration rules.
- [Track A: Simulation](docs/track-a-simulation.md): gate semantics, evaluation, diagnostics, and tests.
- [Track B: Game state](docs/track-b-game-state.md): actions, inventory, modes, history, and store tests.
- [Track C: Content and persistence](docs/track-c-content-persistence.md): level loading, linting, storage, and tests.

When a guide and implementation disagree, update the shared contract and its types in the same pull request before depending on the changed behavior.
