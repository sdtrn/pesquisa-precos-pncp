# SDD ledger — plan: docs/superpowers/plans/2026-10-31-pncp-vercel-plan.md

Pre-flight: all tasks share consistent TypeScript interfaces in `src/lib/domain/types.ts` verified against the spec `docs/superpowers/specs/2026-10-31-pncp-vercel-design.md`.

Task 1: Ruling: Google Drive virtual filesystem (`G:\`) throws `EBADF: bad file descriptor` when `npm` extracts thousands of tar entries into `G:\...\node_modules` — Decided to install `node_modules` in `$LOCALAPPDATA\PesquisaPrecosPNCP_Vercel_deps\node_modules` and link via NTFS junction (`mklink /J`) locally while keeping `package.json` and `package-lock.json` standard for Vercel — Cost if wrong: none, Vercel builds from `package.json` on its own Linux filesystem.
Task 1: complete (tests: vitest run tests/domain/municipios-and-tz.test.ts → 7 passed)
Task 2: complete (tests: vitest run → 11 passed)
Task 3: complete (tests: vitest run → 15 passed)
Task 4: complete (tests: vitest run → 19 passed)
Task 5: complete (tests: vitest run → 21 passed)
