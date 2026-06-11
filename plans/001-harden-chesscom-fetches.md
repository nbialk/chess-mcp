# Plan 001: Harden chess.com fetch calls and stop flagging "not found" as a tool error

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ded809d..HEAD -- src/server.ts`
> If `src/server.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

This MCP server (a public ChatGPT/Claude app on Cloud Run) calls the chess.com
public API with bare `fetch`. Three problems today:

1. **No timeout** — if chess.com hangs, the tool call hangs until the platform
   kills the request. The user sees a stuck spinner.
2. **`res.json()` can throw** on a malformed/non-JSON body, which rejects the
   tool handler with an unhandled exception instead of a clean "not found".
3. **`username` is interpolated into URL paths without encoding** — a username
   containing spaces, `#`, `?`, or unicode produces a broken request URL.

Additionally, both tools return `isError: true` for "player/game not found".
A lookup miss is a valid result, not a tool execution error: clients may render
it as a failure, and the analytics middleware (src/server.ts:367-377 — it
derives `success` from `result.isError`) records every miss as a failed
request, skewing the error rate in PostHog.

## Current state

All changes are in one file:

- `src/server.ts` — server entry; defines both tools. Each tool handler has its
  **own identical copy** of a local `fetchJson` helper. This duplication is
  intentional for now — a later plan (004) consolidates them. In this plan you
  edit **both copies identically**.

Excerpt 1 — `fetchJson` inside the `get-chess-player` handler
(src/server.ts:116-127):

```ts
const fetchJson = async (url: string) => {
  const res = await fetch(url, {
    headers: { "User-Agent": "skybridge-chess-app" },
  });
  if (!res.ok) return null;
  return res.json();
};

const [profile, stats] = await Promise.all([
  fetchJson(`https://api.chess.com/pub/player/${handle}`),
  fetchJson(`https://api.chess.com/pub/player/${handle}/stats`),
]);
```

Excerpt 2 — the not-found return of `get-chess-player`
(src/server.ts:129-137):

```ts
if (!profile) {
  return {
    structuredContent: { found: false, username: handle },
    content: [
      { type: "text", text: `No Chess.com player found for "${username}".` },
    ],
    isError: true,
  };
}
```

Excerpt 3 — `fetchJson` copy and not-found object inside the `get-last-game`
handler (src/server.ts:225-246):

```ts
const fetchJson = async (url: string) => {
  const res = await fetch(url, {
    headers: { "User-Agent": "skybridge-chess-app" },
  });
  if (!res.ok) return null;
  return res.json();
};

const notFound = {
  structuredContent: { found: false as const, username: handle },
  content: [
    {
      type: "text" as const,
      text: `No recent Chess.com game found for "${username}".`,
    },
  ],
  isError: true,
};

const archives = await fetchJson(
  `https://api.chess.com/pub/player/${handle}/games/archives`,
);
```

Context: `handle` is `username.trim().toLowerCase()` (src/server.ts:114 and
:223). It is also used in display strings and in `structuredContent.username`,
so do **not** URL-encode `handle` itself — encode only at the three API URL
construction sites.

Repo conventions: TypeScript strict (tsconfig extends `skybridge/tsconfig`),
ES modules, no semicolon/style tooling — match the surrounding code style
exactly. Node version is 24 (`engines` in package.json), so
`AbortSignal.timeout()` is available natively.

## Commands you will need

| Purpose            | Command           | Expected on success                          |
|--------------------|-------------------|----------------------------------------------|
| Install            | `pnpm install`    | exit 0                                        |
| Build + typecheck  | `pnpm build`      | exit 0 (runs `tsc -b --force`, then Vite)     |
| Typecheck only     | `npx tsc --noEmit`| exit 0, no output                             |
| Manual smoke test  | `pnpm dev`        | DevTools UI at http://localhost:3000          |

## Scope

**In scope** (the only files you should modify):
- `src/server.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/analytics.ts` — the middleware's success/isError derivation is correct;
  the fix is in what the tools return.
- `src/views/**` — both views already branch on `output.found`, not on
  `isError`; no view change is needed.
- Extracting a shared `fetchJson` module — deliberately deferred to plan 004.

## Git workflow

- Branch: `advisor/001-harden-chesscom-fetches` (repo has no branch convention;
  work lands on `main` via PR).
- Conventional Commits, matching the repo's log style (e.g.
  `fix(server): report version from APP_VERSION env`). Suggested message:
  `fix(server): add fetch timeouts, URL-encode usernames, soften not-found results`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Harden both `fetchJson` copies

Replace **both** local `fetchJson` definitions (the one at src/server.ts:116
and the one at src/server.ts:225) with this exact shape:

```ts
const fetchJson = async (url: string) => {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "skybridge-chess-app" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};
```

This makes timeouts, network errors, and JSON parse failures all resolve to
`null`, which both handlers already treat as "not found".

**Verify**: `grep -c "AbortSignal.timeout(10_000)" src/server.ts` → `2`

### Step 2: URL-encode the username at the three API URL sites

Wrap `handle` in `encodeURIComponent(...)` at exactly these three fetch URLs:

1. `https://api.chess.com/pub/player/${handle}` (src/server.ts:125)
2. `https://api.chess.com/pub/player/${handle}/stats` (src/server.ts:126)
3. `https://api.chess.com/pub/player/${handle}/games/archives` (src/server.ts:245)

Example: `` fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(handle)}`) ``

Do NOT change other uses of `handle` (display text, `structuredContent`,
the `https://www.chess.com/member/${handle}` fallback URL at src/server.ts:163).

**Verify**: `grep -c "encodeURIComponent(handle)" src/server.ts` → `3`

### Step 3: Change not-found results to `isError: false`

- In the `get-chess-player` not-found return (Excerpt 2), change
  `isError: true` to `isError: false`.
- In the `get-last-game` `notFound` object (Excerpt 3), change
  `isError: true` to `isError: false`.

The `structuredContent.found: false` field remains the signal for both the
model and the views; the analytics middleware will now correctly count lookup
misses as successful requests.

**Verify**: `grep -c "isError: true" src/server.ts` → `0`

### Step 4: Build

**Verify**: `pnpm build` → exit 0.

### Step 5: Manual smoke test (best-effort)

Run `pnpm dev`, open http://localhost:3000, and in the DevTools UI call:

- `get-chess-player` with username `magnuscarlsen` → player card renders.
- `get-chess-player` with username `this-user-does-not-exist-xyz123` →
  "No Chess.com player found" state renders (no thrown error).
- `get-chess-player` with username `a b/c` (contains a space and slash) →
  not-found state renders, server logs show no crash.

If the DevTools UI is unavailable in your environment, note that in your
report and rely on Steps 1–4.

## Test plan

No test runner exists yet (plan 003 introduces Vitest). The grep gates in
Steps 1–3 plus `pnpm build` are the machine-checkable verification for this
plan. When plan 004 later extracts the chess.com client, these behaviors
(timeout → null, bad JSON → null, encoded URLs) must get unit tests there.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "AbortSignal.timeout(10_000)" src/server.ts` prints `2`
- [ ] `grep -c "encodeURIComponent(handle)" src/server.ts` prints `3`
- [ ] `grep -c "isError: true" src/server.ts` prints `0`
- [ ] `pnpm build` exits 0
- [ ] `git status --short` shows only `src/server.ts` modified (plus
      `plans/README.md` if you update the index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts above don't match the live code at the cited lines (drift).
- There are more or fewer than two `fetchJson` definitions in
  `src/server.ts` — the file layout has changed and line targets are stale.
- `pnpm build` fails twice after a reasonable fix attempt.
- You find a use of `isError: true` that is NOT one of the two not-found
  returns described above — that would be a genuine error path that must
  stay `true`; report instead of changing it.

## Maintenance notes

- Plan 004 will extract these duplicated helpers into a typed
  `src/chess-com.ts` module — keep the two copies textually identical so the
  extraction is mechanical.
- Reviewer should scrutinize: that `handle` itself was not encoded (display
  strings must keep the raw username), and that the timeout (10s) is below
  Cloud Run's request timeout.
- Deferred: retry/backoff on chess.com 429s — not worth it at current traffic.
