# Plan 006: Add an ESLint gate and a standalone typecheck script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ded809d..HEAD -- package.json .github/workflows/ci.yml src/`
> Drift from plans 001–004 in `src/` and from plan 003 in `package.json`/
> `ci.yml` is **expected and fine**. A pre-existing ESLint/Biome config
> appearing anywhere is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/004-typed-chesscom-client.md (removes the `any` usages
  that would otherwise fail `@typescript-eslint/no-explicit-any`). Soft-depends
  on plan 003 (CI file already has a test step to anchor against).
- **Category**: dx
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

The repo has no linter at all. Type errors ARE gated (verified: `pnpm build`
runs `tsc -b --force` before Vite — see `skybridge`'s build command), but
nothing catches unused variables, missing React hook dependencies, or other
correctness lints, and there is no fast standalone typecheck for agents/CI
to run without a full build. This plan adds the standard Vite-ecosystem
ESLint flat-config setup (typescript-eslint + react-hooks), a `lint` script
with a CI step, and a `typecheck` script for fast local feedback.

## Current state

- No ESLint/Biome/Prettier config anywhere in the repo (verified at
  `ded809d`: no `eslint.config.*`, `.eslintrc*`, `biome.json`).
- `package.json` scripts (lines 8-13): `dev`, `dev:tunnel`, `build`, `start`
  (plus `test` if plan 003 landed).
- `.github/workflows/ci.yml` — `build` job ends with `- run: pnpm build`
  (line 26; plus `- run: pnpm test` if plan 003 landed). A second `mcplint`
  job lints the MCP tool definitions at runtime — unrelated to source lint.
- Known lint-sensitive spots in current source (so first run doesn't surprise
  you):
  - `src/server.ts` `serveAsset` handler uses an intentionally-unused
    parameter `_req` (src/server.ts:400) — the config below ignores
    `_`-prefixed args.
  - `src/server.ts` had `any` usages at `ded809d` (formatMode, games array);
    plan 004 removes them. If they are still present, see STOP conditions.
- React hooks in views (`useEffect` in src/views/get-last-game/index.tsx:37
  and moves-panel.tsx:34) — `react-hooks/exhaustive-deps` should pass as
  written; treat any report as a real finding, not noise.

## Commands you will need

| Purpose            | Command            | Expected on success                  |
|--------------------|--------------------|---------------------------------------|
| Install            | `pnpm install`     | exit 0                                |
| Lint               | `pnpm lint`        | exit 0, no errors                     |
| Typecheck          | `pnpm typecheck`   | exit 0                                |
| Build              | `pnpm build`       | exit 0                                |
| Tests (if present) | `pnpm test`        | exit 0                                |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (devDependencies + `lint` and `typecheck` scripts)
- `pnpm-lock.yaml` (via `pnpm add`, not by hand)
- `eslint.config.js` (create)
- `.github/workflows/ci.yml` (add lint step)
- Minimal source fixes ONLY for genuine lint errors the new config reports
  (each one listed in your report; no drive-by refactors)

**Out of scope** (do NOT touch):
- Formatting tooling (Prettier/Biome format) — deliberately excluded to
  avoid churning every file; lint rules only.
- A `pnpm typecheck` step in CI — redundant; `pnpm build` already typechecks.
- The `mcplint` CI job.
- Type-aware ("recommendedTypeChecked") linting — overkill at this size.

## Git workflow

- Branch: `advisor/006-lint-gate`
- Conventional Commits. Suggested message:
  `ci: add eslint gate and typecheck script`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install dependencies

```sh
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
```

**Verify**: exit 0; all four appear in `package.json` devDependencies.

### Step 2: Create `eslint.config.js`

```js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".skybridge", ".next", ".vercel", "public", "plans"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
```

Note: the react-hooks flat-config export name varies by plugin major version
(`configs["recommended-latest"]` on v5/v6; some versions expose
`configs.flat.recommended`). Check the installed version's README under
`node_modules/eslint-plugin-react-hooks` and use its documented flat-config
export. If neither exists, see STOP conditions.

**Verify**: `npx eslint --print-config src/server.ts | head -1` → prints JSON
(config resolves).

### Step 3: Add scripts

In `package.json` scripts:

```json
"lint": "eslint .",
"typecheck": "tsc --noEmit"
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Run lint and fix genuine errors

Run `pnpm lint`. Expected: zero or a small number of findings.

- Fix mechanical, unambiguous errors (unused imports/vars) directly.
- For anything judgment-based (a reported `exhaustive-deps` violation, an
  `any` that plan 004 should have removed), do NOT fix — record it and see
  STOP conditions.

**Verify**: `pnpm lint` → exit 0.

### Step 5: Add the CI step

In `.github/workflows/ci.yml`, `build` job, add immediately after the
`pnpm install --frozen-lockfile` step:

```yaml
      - run: pnpm lint
```

(Before the build step — lint is the fastest gate, fail early.)

**Verify**: `grep -n "pnpm lint" .github/workflows/ci.yml` → 1 hit inside the
`build` job, indented to match sibling `- run:` steps (6 spaces).

### Step 6: Full local gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm build` → all exit 0 (and
`pnpm test` if the script exists).

## Test plan

Not applicable — tooling change. The gates are the lint/typecheck/build
commands themselves.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -c "pnpm lint" .github/workflows/ci.yml` prints `1`
- [ ] `eslint.config.js` exists and `npx eslint --print-config src/server.ts`
      resolves
- [ ] `git status --short` shows only in-scope files (plus any source files
      with mechanical lint fixes, each named in your report, plus
      `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- An ESLint/Biome config already exists anywhere in the repo.
- The installed `eslint-plugin-react-hooks` exposes no flat-config preset
  under either documented name.
- `pnpm lint` reports `@typescript-eslint/no-explicit-any` errors in
  `src/server.ts` — plan 004 has not landed; do not downgrade the rule or
  scatter disable comments; report the dependency violation.
- `pnpm lint` reports a `react-hooks/exhaustive-deps` error — that is a
  potential real bug in a view; report it for human review instead of
  auto-"fixing" the dependency array.
- Fixing lint errors would require touching more than 3 source files.

## Maintenance notes

- Keep the ignores list in `eslint.config.js` in sync with build-output
  directories if any are added.
- Reviewer should scrutinize: no rules were silently downgraded to `warn`
  and no `eslint-disable` comments were introduced.
- Deferred: formatter (Prettier/Biome) and type-aware lint preset — revisit
  if contributor count grows beyond one.
