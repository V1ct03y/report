# AGENTS.md

## Purpose

This repository is an anonymous rating and settlement system with a Vue 3 frontend and an Express + SQLite backend. Use this file as the working agreement for future agents: where to look, how to run the app, how to validate changes, and which workflows are expected in this codebase.

## Repo Map

- `frontend/`: Vue frontend workspace.
- `frontend/src/views/`: role-based pages for login, member rating, public results, archive history, admin dashboard, submission status, and supervisor scoring.
- `frontend/src/components/`: shared UI plus admin, account, member, and public-facing components.
- `frontend/src/router/index.ts`: route-level access control and default redirects.
- `frontend/src/stores/app.ts`: client session/app state.
- `frontend/src/api.ts`: frontend API client; defaults to `VITE_API_BASE` or `/api`.
- `backend/src/`: Express API, SQLite bootstrap, services, and route handlers.
- `backend/src/db/init.js`: schema creation, compatibility migration, seed users, and planned-cycle seeding.
- `backend/src/services/`: auth, member scoring, cycle lifecycle, cycle admin, scheduling, settlement, and user admin logic.
- `e2e/`: Playwright end-to-end coverage for cycle-plan management, publication, settlement, masking, and rating flows.
- `frontend/test/`: lightweight repo-specific checks for layout and config consistency.
- `test-results/` and `*.png`: generated debugging artifacts. Do not treat them as source unless the task is specifically about visual/debug output.

## Workspace Layout

This repo uses `npm` workspaces:

- root workspace orchestrates scripts and Playwright
- `frontend/` contains the Vite + Vue app
- `backend/` contains the Express + SQLite API

Prefer root-level scripts when they already exist. Drop into a workspace only when a command is workspace-specific.

## Core Commands

Run commands from the repository root unless the command explicitly changes directories.

### Install

```bash
npm install
```

Notes:

- Root `npm install` installs both workspaces through `npm` workspaces.
- If backend env is missing, copy `backend/.env.example` to `backend/.env` before running backend setup.

### Frontend

```bash
npm run dev:frontend
npm run build
npm run test:frontend
```

Equivalent workspace-local commands:

```bash
npm --workspace frontend run dev
npm --workspace frontend run build
```

Notes:

- Vite dev server is configured in `frontend/vite.config.ts` to run on `4173`.
- Frontend API requests proxy `/api` to `http://127.0.0.1:4300`.
- Root `npm run build` builds the frontend workspace.
- `npm run test:frontend` currently prints guidance and exits; use the files under `frontend/test/` only when the task specifically touches them.

### Backend

```bash
cp backend/.env.example backend/.env
npm --workspace backend run db:init
npm --workspace backend run db:reset:acceptance
npm run dev:backend
```

Equivalent workspace-local commands:

```bash
npm --prefix backend run dev
```

Notes:

- Backend defaults to `http://localhost:4300`.
- `backend/src/index.js` runs both the API server and the scheduler when started directly.
- Database path defaults to `backend/data/app.db`.
- `npm --workspace backend run db:init` is the formal production initializer: schema + default admin + planned cycles.
- `npm --workspace backend run db:reset:acceptance` is destructive and only for local demo / acceptance data.
- `npm run dev:backend` maps to the backend workspace watcher.

### Playwright

```bash
npm run test:e2e
npx playwright test e2e/admin-cycle-plan-list.spec.ts
npx playwright test e2e/full-rating-flow.spec.ts
npx playwright test e2e/cycle-control-publication.spec.ts
```

Important:

- `playwright.config.ts` uses `baseURL: http://localhost:4173`.
- Playwright currently runs Chromium only with `workers: 1`.
- Start the frontend and backend separately before running Playwright unless you intentionally provide your own running environment.

## Seed Accounts

Default password: `ChangeMe123!`

- Admin: `kwok-admin`
- Leaders: `leader-a`, `leader-b`
- Members: `zhangsan`, `lisi`, `wangwu`, `zhaoliu`

## Standard Workflows

### 1. Frontend-only change

Use when editing Vue views, components, styling, or client routing.

1. Inspect the target screen in `frontend/src/views/` and any shared component dependencies in `frontend/src/components/`.
2. Check `frontend/src/api.ts`, `frontend/src/types.ts`, and `frontend/src/stores/app.ts` before changing data assumptions.
3. Run `npm run build` after code changes.
4. If the change touches role flows, public results, cycle management, publication, or scheduling, run the relevant Playwright spec.

### 2. Backend/API change

Use when editing route handlers, services, scheduling, settlement, or schema/bootstrap logic.

1. Inspect the route file and the service it calls before changing behavior.
2. If the schema or seeded data changes, review `backend/src/db/init.js` and lifecycle services together.
3. Start the backend with `npm run dev:backend` or `npm --workspace backend run dev` so scheduler behavior matches real usage.
4. Validate the frontend contract in `frontend/src/api.ts` if request/response shape changes.

### 3. Full-stack behavior change

Use when a feature crosses UI, API, and data layers.

1. Trace from route entry point to service to frontend consumer.
2. Keep request/response naming aligned across `backend/src/routes`, `backend/src/services`, and `frontend/src/api.ts`.
3. Run `npm run build`.
4. Run the most targeted Playwright spec first, then broaden only if the change affects multiple user roles.

### 4. Data-reset or bootstrap workflow

Use when local data is stale or incompatible.

1. Ensure `backend/.env` exists.
2. For formal local data, run `npm --workspace backend run db:init`.
3. For demo / acceptance data, run `npm --workspace backend run db:reset:acceptance`.
4. Re-test with the seeded accounts above.

## Validation Expectations

- There is no dedicated root lint script right now.
- `npm run build` is the minimum frontend validation.
- `npm run test:backend` runs the backend Node test suite.
- Playwright is the primary regression layer for role-based flows, masking, cycle-plan management, publication, and settlement.
- Prefer targeted verification over broad reruns, but do not skip E2E when changing:
  - public result masking
  - settlement timing or cycle-plan progression
  - cycle creation/edit/delete behavior
  - publication / visibility controls
  - login or first-password-reset flow
  - member / leader / admin permissions

## Guardrails For Agents

- Preserve the current architecture: Vue client in `frontend/`, Express API in `backend/src/`.
- Do not silently change ports without updating the docs/config that depend on them.
- Be careful with seeded roles: this codebase uses `member`, `leader`, and `admin` rather than the older `employee` and `manager` names.
- When touching scheduler, publication, or settlement logic, assume timing-sensitive regressions are possible and verify them explicitly.
- Some Chinese UI strings may appear garbled in terminal output because of encoding/display differences. Verify meaning from code context before mass-editing text.
- Avoid editing generated screenshots, `dist/`, `frontend/dist/`, or `test-results/` unless the task is specifically about generated artifacts.

## Fast Triage Shortcuts

- UI route or permission issue: inspect `frontend/src/router/index.ts` and `frontend/src/stores/app.ts`.
- API request failure from UI: inspect `frontend/src/api.ts` and the matching backend route.
- Missing or incorrect cycle data: inspect `backend/src/services/cycle.service.js`, `backend/src/services/cycle-admin.service.js`, and `backend/src/services/cycle-lifecycle.service.js`.
- Settlement or public-results issue: inspect `backend/src/services/settlement.service.js` and `frontend/src/views/ResultsPublicView.vue`.
- Cycle-plan progression issue: inspect `backend/src/services/scheduling.service.js`, `backend/src/services/cycle-lifecycle.service.js`, and `e2e/admin-cycle-plan-list.spec.ts`.
- Publication or visibility issue: inspect `backend/src/services/cycle-control.service.js`, related admin routes, and `e2e/cycle-control-publication.spec.ts`.
