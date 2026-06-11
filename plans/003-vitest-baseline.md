# Plan 003: Establish a unit-test baseline with Vitest for the pure game logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ded809d..HEAD -- src/views/get-last-game/lib.ts src/views/get-last-game/moves-panel.tsx package.json .github/workflows/ci.yml`
> If any of those changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

The repo has zero tests and no test runner; the only verification gate is
`pnpm build`. The pure logic that actually has edge cases — FEN parsing for
the board, relative timestamps, move-pair grouping — is unverified, and a
later plan (004) wants to refactor the server's chess.com logic, which is
unsafe without a test harness to extend. This plan installs Vitest (Vite is
already the build tool, so it is the natural fit), wires a `pnpm test`
script and CI step, and covers the three pure helpers that exist today.

## Current state

- `package.json` — scripts are only `dev`, `dev:tunnel`, `build`, `start`
  (lines 8-13). No `test` script, no test runner installed. Vite `^8.0.3` is
  a dependency; **Vitest 4.x declares `vite: ^6 || ^7 || ^8` as a peer**, so
  the latest Vitest 4 is compatible (verified against the npm registry).
- `vite.config.ts` — loads the `skybridge()`, `react()`, and `tailwindcss()`
  plugins. Do NOT let Vitest consume this config: the Skybridge plugin is
  build-oriented. A standalone `vitest.config.ts` takes precedence over
  `vite.config.ts` automatically when present.
- `.github/workflows/ci.yml` — `build` job: checkout → pnpm setup → node
  setup → `pnpm install --frozen-lockfile` → `pnpm build` (lines 12-26).
- `src/views/get-last-game/lib.ts` — pure helpers `fenToRows` (lines 22-35)
  and `timeAgo` (lines 37-44), plus icon/style constant maps. Imports only
  `lucide-react` (plain ESM, safe to import under Node).
- `src/views/get-last-game/moves-panel.tsx` — contains a private pure helper
  `toMoveRows` (lines 3-15) that should be testable; it will move to `lib.ts`.

Excerpt 1 — `src/views/get-last-game/lib.ts:22-44`:

```ts
export function fenToRows(fen: string): string[][] {
  const placement = fen.split(" ")[0];
  return placement.split("/").map((row) => {
    const squares: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) squares.push("");
      } else {
        squares.push(ch);
      }
    }
    return squares;
  });
}

export function timeAgo(unixSeconds: number) {
  const diff = Date.now() / 1000 - unixSeconds;
  const day = 86400;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < day) return `${Math.round(diff / 3600)}h ago`;
  if (diff < day * 30) return `${Math.round(diff / day)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}
```

Excerpt 2 — `src/views/get-last-game/moves-panel.tsx:1-15`:

```tsx
import { useEffect, useRef } from "react";

type MoveRow = { number: number; white?: string; black?: string };

function toMoveRows(moves: string[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }
  return rows;
}
```

Conventions: TypeScript strict, ES modules with explicit `.js` import
suffixes for local files (see `import { fenToRows } from "./lib.js"` in
board.tsx:13). Match that in new imports.

## Commands you will need

| Purpose            | Command              | Expected on success                       |
|--------------------|----------------------|--------------------------------------------|
| Install            | `pnpm install`       | exit 0                                     |
| Add dev dep        | `pnpm add -D vitest` | exit 0, vitest 4.x in devDependencies      |
| Tests              | `pnpm test`          | exit 0, all tests pass                     |
| Build + typecheck  | `pnpm build`         | exit 0                                     |
| Typecheck only     | `npx tsc --noEmit`   | exit 0, no output                          |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add devDependency + `test` script)
- `pnpm-lock.yaml` (via `pnpm add`, not by hand)
- `vitest.config.ts` (create)
- `src/views/get-last-game/lib.ts` (move `toMoveRows` + its `MoveRow` type in)
- `src/views/get-last-game/moves-panel.tsx` (import `toMoveRows` instead of
  defining it)
- `src/views/get-last-game/lib.test.ts` (create)
- `.github/workflows/ci.yml` (add test step)

**Out of scope** (do NOT touch):
- `vite.config.ts` — the build config stays as is; Vitest gets its own file.
- `src/server.ts` — server logic tests arrive with plan 004's extraction.
- Component/DOM testing (jsdom, Testing Library) — deliberately excluded;
  this plan covers pure functions only.

## Git workflow

- Branch: `advisor/003-vitest-baseline`
- Conventional Commits. Suggested message:
  `test: add vitest baseline covering board and move helpers`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install Vitest and add the script

Run `pnpm add -D vitest`. In `package.json` scripts, add:

```json
"test": "vitest run"
```

**Verify**: `pnpm test` → exits non-zero with "No test files found" (expected
at this point — runner works, no tests yet).

### Step 2: Create `vitest.config.ts`

Create at the repo root:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

No plugins — that is intentional (see Current state).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Move `toMoveRows` into `lib.ts`

1. In `src/views/get-last-game/lib.ts`, add (exported) the `MoveRow` type and
   `toMoveRows` function exactly as in Excerpt 2, but with `export` on both.
2. In `src/views/get-last-game/moves-panel.tsx`, delete the local `MoveRow`
   type and `toMoveRows` function and import them instead:

```ts
import { toMoveRows } from "./lib.js";
```

(The `MoveRow` type is only used inside `toMoveRows`'s signature; import it
only if the compiler requires it.)

**Verify**: `npx tsc --noEmit` → exit 0, and
`grep -c "function toMoveRows" src/views/get-last-game/moves-panel.tsx` → `0`.

### Step 4: Write `src/views/get-last-game/lib.test.ts`

Cover at minimum (use these literal cases):

`fenToRows`:
- Start position
  (`rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`) → 8 rows of 8
  squares; row 0 equals `["r","n","b","q","k","b","n","r"]`; rows 2–5 are all
  empty strings.
- Digit expansion mid-row: row string `r1bqkbnr` (e.g. from FEN
  `r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 2 2`) →
  `["r","","b","q","k","b","n","r"]`.
- Only the placement field is read: trailing FEN fields never appear in
  output (no row contains `"w"` or `"-"`).

`timeAgo` (freeze the clock — `timeAgo` calls `Date.now()`):

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
```

- 30 seconds ago → `"1m ago"` (the `Math.max(1, ...)` floor).
- 5 minutes ago → `"5m ago"`.
- 2 hours ago → `"2h ago"`.
- 3 days ago → `"3d ago"`.
- 60 days ago → equals
  `new Date(unixSeconds * 1000).toLocaleDateString()` (compare against the
  same expression, NOT a literal — the output is locale-dependent).

`toMoveRows`:
- `[]` → `[]`.
- `["e4"]` → `[{ number: 1, white: "e4", black: undefined }]`.
- `["e4", "e5", "Nf3"]` → two rows; row 2 is
  `{ number: 2, white: "Nf3", black: undefined }`.

**Verify**: `pnpm test` → exit 0, 3 test files... (one file, ≥11 tests) all
passing.

### Step 5: Add the CI step

In `.github/workflows/ci.yml`, in the `build` job, add after the
`- run: pnpm build` step (line 26):

```yaml
      - run: pnpm test
```

**Verify**: `npx -y yaml-lint .github/workflows/ci.yml` if available, else
visually confirm indentation matches the sibling `- run:` steps (6 spaces).

### Step 6: Full local gate

**Verify**: `pnpm build && pnpm test` → both exit 0.

## Test plan

This plan IS the test plan: one new file
`src/views/get-last-game/lib.test.ts` with the cases listed in Step 4. There
is no existing test to model after — this file becomes the structural pattern
for future tests (plain `describe`/`it`/`expect` from `vitest`, fake timers
for time-dependent code).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test` exits 0 and reports ≥ 11 passing tests
- [ ] `pnpm build` exits 0
- [ ] `grep -c '"test": "vitest run"' package.json` prints `1`
- [ ] `grep -c "pnpm test" .github/workflows/ci.yml` prints `1`
- [ ] `grep -c "export function toMoveRows" src/views/get-last-game/lib.ts`
      prints `1`
- [ ] `git status --short` shows only in-scope files modified (plus
      `plans/README.md` if you update the index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm add -D vitest` fails with a peer-dependency conflict against
  `vite@8` — report the exact resolution error instead of forcing.
- Importing `lib.ts` under Node fails because of the `lucide-react` import
  (e.g. ESM resolution error). Do NOT mock or restructure imports on your
  own; report the error.
- `vitest` picks up `vite.config.ts` and the Skybridge plugin breaks the run
  even with `vitest.config.ts` present.
- The locale-dependent `timeAgo` case cannot be made deterministic with the
  same-expression comparison.

## Maintenance notes

- Plan 004 (chess.com client extraction) depends on this harness; its new
  pure functions get tests in the same style, matching this file.
- Reviewer should scrutinize: `vitest.config.ts` has no plugins, and the CI
  step runs in the `build` job (not the `mcplint` job).
- Deferred: component/DOM tests and coverage thresholds — not worth it at
  this repo size.
