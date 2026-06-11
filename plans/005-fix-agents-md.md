# Plan 005: Make AGENTS.md accurate so agents stop being primed with an unfollowable instruction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ded809d..HEAD -- AGENTS.md`
> If `AGENTS.md` changed since this plan was written, compare against the
> "Current state" excerpt; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (one bullet adapts if plans 003/006 have landed — see Step 1)
- **Category**: docs
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

The tracked `AGENTS.md` is one line that instructs every agent session to
"ALWAYS use the `skybridge` skill" — a skill that does not exist in this
repository or in the configured skill directories. Every agent starts with an
instruction it cannot follow, and gets zero actual guidance (stack, commands,
conventions). For a repo where plans are executed by agents, an accurate
minimal agent guide is high leverage for its size.

## Current state

- `AGENTS.md` (repo root, tracked) — entire content:

```
This is a ChatGPT/MCP app built with Skybridge. ALWAYS use the `skybridge` skill when planning or updating the codebase.
```

- Verified: no `skybridge` skill exists under `.claude/skills/`,
  `.agents/skills/`, or `.opencode/` (those directories are local-only and
  untracked anyway).
- Repo facts to encode (verified at commit `ded809d`):
  - Skybridge MCP app (ChatGPT/Claude apps): `src/server.ts` defines tools;
    one React view per tool in `src/views/` named after the tool.
  - `pnpm dev` → MCP server + DevTools at http://localhost:3000;
    `pnpm build` → compiles server (`tsc -b`, so it typechecks) then builds
    views with Vite; `pnpm start` → run built app.
  - TypeScript strict, ES modules with explicit `.js` suffixes on local
    imports, Tailwind CSS v4, zod v4, kebab-case file names.
  - Conventional Commits (`feat(server): …`, `fix(views): …`), releases via
    release-please, deploys to Cloud Run on release tags.

## Commands you will need

| Purpose            | Command           | Expected on success |
|--------------------|-------------------|----------------------|
| Build + typecheck  | `pnpm build`      | exit 0               |

## Scope

**In scope** (the only file you should modify):
- `AGENTS.md`

**Out of scope** (do NOT touch):
- `.agents/`, `.claude/`, `.opencode/`, `.mcp.json`, `opencode.json` — these
  are the maintainer's local, untracked agent setup.
- `README.md` — human-facing docs are already accurate.
- `scripts/agents/sync-agent-shims.mjs` — unrelated tooling.

## Git workflow

- Branch: `advisor/005-fix-agents-md`
- Conventional Commits. Suggested message:
  `docs(agents): replace missing-skill instruction with accurate repo guide`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the content of `AGENTS.md`

Write exactly this content (adjust only the two marked lines):

```markdown
# AGENTS.md

This is a ChatGPT/MCP app built with [Skybridge](https://docs.skybridge.tech)
(MCP server + one React view per tool). It looks up Chess.com players and
games via the chess.com public API.

## Commands

- `pnpm install` — install dependencies (pnpm 9, Node 24).
- `pnpm dev` — MCP server at http://localhost:3000/mcp + DevTools UI at
  http://localhost:3000 (use the DevTools UI to invoke tools manually).
- `pnpm build` — typechecks (`tsc -b`) and builds server + views. This is
  the primary verification gate.
- `pnpm test` — Vitest unit tests.            <!-- omit if no test script -->
- `pnpm lint` / `pnpm typecheck` — ESLint / tsc. <!-- omit if scripts absent -->

## Structure

- `src/server.ts` — server entry: tool definitions (zod schemas), analytics
  middleware, asset routes.
- `src/views/<tool-name>...` — one React view per tool; the view component
  name matches the tool name.
- `src/helpers.ts` — typed `useToolInfo`/`useCallTool` via
  `generateHelpers<AppType>`.
- `src/analytics.ts` — PostHog wrapper; no-op unless `POSTHOG_API_KEY` is set.

## Conventions

- TypeScript strict; ES modules with explicit `.js` suffix on local imports.
- Kebab-case file names; Tailwind CSS v4 for styling.
- Tool results: model-facing data goes in `structuredContent` (validated
  against `outputSchema`); view-only data goes in `_meta` and is read via
  `responseMetadata` in the view.
- Conventional Commits (`feat(server): …`, `fix(views): …`). Releases are
  cut by release-please; merging the release PR deploys to Cloud Run.
- Never commit, push, or open PRs unless explicitly asked.
```

The two `<!-- omit -->` markers: check `package.json` scripts — include the
`pnpm test` line only if a `test` script exists (plan 003), and the
`pnpm lint`/`pnpm typecheck` line only if those scripts exist (plan 006).
Remove the HTML comments either way.

**Verify**: `grep -c "skybridge skill" AGENTS.md` → `0`, and every command
named in the file exists in `package.json` scripts
(`grep '"test"\|"lint"\|"typecheck"' package.json` matches what you kept).

### Step 2: Sanity-check the build is unaffected

**Verify**: `pnpm build` → exit 0 (docs-only change; this confirms a clean
tree).

## Test plan

Not applicable — documentation change. The grep gates in Step 1 are the
verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -ci "always use the .skybridge. skill" AGENTS.md` prints `0`
- [ ] Every `pnpm <script>` mentioned in AGENTS.md exists in
      `package.json` scripts
- [ ] `git status --short` shows only `AGENTS.md` modified (plus
      `plans/README.md` if you update the index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A `skybridge` skill HAS appeared (check `.claude/skills/`,
  `.agents/skills/`, `.opencode/skills/`) — the original instruction may have
  become valid; the maintainer should decide whether to keep referencing it.
- `AGENTS.md` no longer matches the one-line excerpt (someone already
  rewrote it).

## Maintenance notes

- When tools/scripts change (new tool, new script in `package.json`), this
  file must be updated in the same PR — reviewers should treat it like code.
- The maintainer's local `.agents/AGENTS.md` (untracked) currently describes
  a different project (Next.js/Prisma/Clerk) and overrides/augments agent
  context in this clone; fixing that is outside this repo's tracked files —
  flagged for the maintainer, not for the executor.
