# ADR 0013: Testing Strategy

- **Status**: proposed
- **Date**: 2026-07-19
- **Deciders**: AI-assisted architecture

---

## Context

artifact-center currently has **zero test coverage** across both frontend (React + Vite) and backend (Hono + Drizzle). As the codebase grows through P1 MVP and beyond, automated testing is essential to prevent regressions, enforce contracts, and enable confident refactoring.

The project uses a monorepo layout:

- Frontend: `src/` — React 19 + Vite 8 + TypeScript 6
- Backend: `apps/api/` — Hono 4 + Drizzle ORM + TypeScript 5.8 + PostgreSQL

Both sides share `type: "module"` (ESM).

---

## Decision

### 1. Unified Test Runner: Vitest

**Vitest is the single test runner for both frontend and backend**, replacing the need for Jest on the frontend and a separate node test runner on the backend.

**Rationale**:

- Native Vite integration (zero-config transform pipeline — TSX, path aliases, CSS modules all work out of the box)
- ESM-first, compatible with the project's `"type": "module"`
- Jest-compatible API (`describe`/`it`/`expect`) with `globals: true`, minimizing migration friction
- Built-in coverage via `@vitest/coverage-v8`
- Built-in UI mode (`vitest --ui`) for interactive debugging
- Hono's official testing guide recommends Vitest + `app.request()`

### 2. Environment Split

| Layer    | Config File                 | Environment | Purpose                                        |
| -------- | --------------------------- | ----------- | ---------------------------------------------- |
| Frontend | `vitest.config.ts` (root)   | `jsdom`     | Component tests, hook tests, integration tests |
| Backend  | `apps/api/vitest.config.ts` | `node`      | Route handlers, middleware, service logic      |

### 3. Test Libraries (Frontend)

| Package                       | Role                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `@testing-library/react`      | Render components, query DOM                                 |
| `@testing-library/jest-dom`   | Semantic matchers (`toBeInTheDocument`, `toHaveTextContent`) |
| `@testing-library/user-event` | Simulate realistic user interactions                         |
| `msw`                         | Intercept and mock HTTP requests at the network level        |

### 4. Test Directory Convention

- Frontend tests co-located or in `src/__tests__/`, matching source structure
- Backend tests under `apps/api/src/__tests__/`
- File naming: `*.test.ts` / `*.test.tsx` / `*.spec.ts` / `*.spec.tsx`

### 5. Test Hierarchy (Testing Trophy)

```
  E2E (future: Playwright)
  /        \
Integration   Integration
(frontend)    (backend)
  \        /
  Unit Tests
```

**Coverage targets (aspirational, not blocking)**:

- Unit tests: ≥ 80% (pure logic, utilities, hooks, services)
- Integration tests: ≥ 60% (component + route integration)
- E2E: critical user journeys (future phase)

### 6. What We Test (per layer)

**Unit tests** — pure functions, Zod schemas, utility helpers, custom hooks (via `renderHook`), DTO transformations.

**Component tests** — rendering with props, user interaction flows, conditional rendering, accessibility with `@testing-library/react`.

**API route tests** — Hono `app.request()` for status codes, response shapes, header assertions, error handling; mock `env` and DB clients via module mocking or dependency injection.

**Integration tests** — React Query + MSW for full data-fetching flows; API middleware chains with real Hono app instances.

---

## Consequences

### Positive

- Single test runner reduces cognitive overhead and tooling fragmentation
- Vitest's watch mode and HMR provide fast feedback loops during development
- Testing Library encourages testing behavior, not implementation details
- MSW enables frontend testing without a running backend

### Negative

- `jsdom` is not a real browser; some layout-dependent tests may need future E2E coverage
- MSW setup adds initial boilerplate for API-dependent component tests
- Backend integration tests that touch PostgreSQL will need a test database or Docker container

### Mitigations

- Add Playwright for E2E in a future ADR when critical user journeys stabilize
- Provide a shared MSW handler factory in `src/mocks/handlers/` to reduce duplication
- Use test containers or Docker Compose profiles for backend DB tests

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles)
- [Hono Testing Guide](https://hono.dev/docs/guides/testing)
- [MSW — Mock Service Worker](https://mswjs.io/)
