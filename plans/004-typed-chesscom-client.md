# Plan 004: Extract a typed chess.com client module and remove `any` from the server

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ded809d..HEAD -- src/server.ts`
> Drift from plans 001 (fetch hardening, `isError: false` on not-found,
> `encodeURIComponent`) and 002 (`positions` moved to `_meta`) is **expected
> and fine** — this plan describes behavior invariants, not exact lines.
> Drift beyond that (new tools, restructured handlers) is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (behavior-preserving refactor of the only production code path)
- **Depends on**: plans/003-vitest-baseline.md (test harness). Strongly
  recommended after 001 and 002 (same file).
- **Category**: tech-debt
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

`src/server.ts` talks to the chess.com public API with a duplicated local
`fetchJson` helper in each tool handler, and every payload flows as `any`
(`formatMode = (mode: any)`, `const games: any[]`). If chess.com's response
shape drifts, failures are silent or cryptic, and the compiler can't help.
This plan extracts a single `src/chess-com.ts` module: typed fetchers with
lenient zod validation at the external boundary, plus pure, unit-tested
helpers for result mapping, PGN tag parsing, opening extraction, and replay
building. `src/server.ts` shrinks to tool definitions and orchestration.

## Current state

- `src/server.ts` — both tools (`get-chess-player`, `get-last-game`), their
  zod output schemas, the analytics middleware, and asset serving. Only the
  tool-handler internals move; schemas, middleware, and asset code stay.
- `src/views/get-last-game/lib.ts` + `lib.test.ts` — the existing pure-helper
  + test pattern to imitate (plain `describe`/`it`/`expect` from `vitest`).
- `zod` v4 and `chess.js` are already dependencies (package.json:16-26).

Logic that moves (line numbers from commit `ded809d`; plans 001/002 may have
shifted them slightly — locate by content):

1. **`fetchJson`** — two identical copies (src/server.ts:116-122 and
   :225-231). After plan 001 each looks like:

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

If plan 001 has NOT landed, the copies lack the try/catch + signal — extract
whatever is there verbatim (do not mix hardening into this refactor). If the
two copies differ from each other, STOP.

2. **`formatMode`** (src/server.ts:139-148) — maps a chess.com stats mode to
   `{ rating, best, win, loss, draw } | null`.

3. **PGN tag extraction** (src/server.ts:256-257):

```ts
const tag = (name: string) =>
  pgn.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? null;
```

4. **Opening extraction from ECOUrl** (src/server.ts:259-264):

```ts
const opening = ecoUrl
  ? decodeURIComponent(ecoUrl.split("/").pop() ?? "")
      .replace(/-/g, " ")
      .trim() || null
  : null;
```

5. **Replay building with chess.js** (src/server.ts:266-282) — loads the PGN,
   replays it, collecting a FEN per position and SAN per move; on any throw,
   both arrays become empty.

6. **Result mapping** (src/server.ts:288-301) — `drawResults` list
   (`agreed`, `repetition`, `stalemate`, `insufficient`, `50move`,
   `timevsinsufficient`); `me?.result === "win"` → win, draw codes → draw,
   everything else → loss.

Behavior invariants (must hold after the refactor — these are the contract):

- Not-found behavior: profile/archives/games missing → the same not-found
  results as today (`found: false`, same text).
- The summary strings in `content[0].text` are byte-identical for the same
  inputs.
- `structuredContent` shapes are unchanged (and still conform to the
  `outputSchema`s, which the MCP SDK validates at runtime).
- If plan 002 landed: `_meta: { positions }` still returned on success.
- If plan 001 landed: usernames stay `encodeURIComponent`-ed in API URLs.

Conventions: explicit `.js` suffix on local imports
(`import { ... } from "./chess-com.js"`), TypeScript strict, no `any` —
prefer `unknown` + zod narrowing.

## Commands you will need

| Purpose            | Command            | Expected on success                  |
|--------------------|--------------------|---------------------------------------|
| Install            | `pnpm install`     | exit 0                                |
| Tests              | `pnpm test`        | exit 0, all pass                      |
| Build + typecheck  | `pnpm build`       | exit 0                                |
| Typecheck only     | `npx tsc --noEmit` | exit 0                                |
| Manual smoke test  | `pnpm dev`         | DevTools UI at http://localhost:3000  |

## Scope

**In scope** (the only files you should modify/create):
- `src/chess-com.ts` (create)
- `src/chess-com.test.ts` (create)
- `src/server.ts` (replace handler internals with calls into the new module)

**Out of scope** (do NOT touch):
- The tool definitions' `inputSchema`/`outputSchema`/`annotations`/`view`/
  `_meta` config blocks in `src/server.ts` — wire format is frozen.
- `src/analytics.ts`, the middleware, `serveAsset`, signal handlers.
- `src/views/**` — no view depends on anything moving here.
- Changing retry/caching/timeout behavior — extraction only.

## Git workflow

- Branch: `advisor/004-typed-chesscom-client`
- Conventional Commits. Suggested message:
  `refactor(server): extract typed chess.com client with zod boundary`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `src/chess-com.ts`

Build the module with this public surface (signatures are load-bearing;
bodies move from server.ts per "Current state"):

```ts
import { Chess } from "chess.js";
import { z } from "zod";

// --- schemas (lenient: only the fields we consume; unknown keys are fine
// because z.object() strips them; consumed fields are optional/nullable so
// harmless API drift degrades to null instead of failing the tool) ---

const modeStatsSchema = z
  .object({
    last: z.object({ rating: z.number().optional() }).optional(),
    best: z.object({ rating: z.number().optional() }).optional(),
    record: z
      .object({
        win: z.number().optional(),
        loss: z.number().optional(),
        draw: z.number().optional(),
      })
      .optional(),
  })
  .optional();

export const profileSchema = z.object({
  username: z.string(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  country: z.string().nullish(),
  location: z.string().nullish(),
  followers: z.number().nullish(),
  status: z.string().nullish(),
  league: z.string().nullish(),
  joined: z.number().nullish(),
  last_online: z.number().nullish(),
  url: z.string().nullish(),
  avatar: z.string().nullish(),
});
export type Profile = z.infer<typeof profileSchema>;

export const statsSchema = z.object({
  fide: z.number().nullish(),
  chess_rapid: modeStatsSchema,
  chess_blitz: modeStatsSchema,
  chess_bullet: modeStatsSchema,
});
export type Stats = z.infer<typeof statsSchema>;

const playerInGameSchema = z
  .object({
    username: z.string().optional(),
    rating: z.number().optional(),
    result: z.string().optional(),
  })
  .optional();

export const gameSchema = z.object({
  pgn: z.string().optional(),
  white: playerInGameSchema,
  black: playerInGameSchema,
  time_class: z.string().nullish(),
  rated: z.boolean().nullish(),
  end_time: z.number().nullish(),
  url: z.string().nullish(),
});
export type Game = z.infer<typeof gameSchema>;

// --- fetchers (single fetchJson, moved from server.ts; parse with
// safeParse and return null on failure) ---

export async function fetchProfile(handle: string): Promise<Profile | null>;
export async function fetchStats(handle: string): Promise<Stats | null>;
export async function fetchArchiveUrls(handle: string): Promise<string[]>;
export async function fetchArchiveGames(url: string): Promise<Game[]>;

// --- pure helpers (moved from server.ts; unit-tested) ---

export function formatMode(mode: Stats["chess_rapid"]):
  | { rating: number | null; best: number | null; win: number; loss: number; draw: number }
  | null;
export function pgnTag(pgn: string, name: string): string | null;
export function extractOpening(ecoUrl: string | null): string | null;
export function buildReplay(pgn: string): { positions: string[]; moves: string[] };
export function mapGameResult(result: string | undefined): "win" | "draw" | "loss";
```

Implementation notes:

- `fetchJson` stays module-private; its body is whatever currently exists in
  `src/server.ts` (both copies — they must be identical).
- Fetchers parse with `schema.safeParse(json)`; on `!success` return
  null / `[]`. `fetchArchiveUrls` parses
  `z.object({ archives: z.array(z.string()).optional() })` and returns
  `parsed.archives ?? []`. `fetchArchiveGames` parses
  `z.object({ games: z.array(gameSchema).optional() })` similarly.
- If plan 001 landed, keep `encodeURIComponent(handle)` in the fetcher URLs.
- `mapGameResult`: `"win"` → `"win"`; one of `agreed | repetition |
  stalemate | insufficient | 50move | timevsinsufficient` → `"draw"`;
  anything else (including `undefined`) → `"loss"` — exactly today's
  semantics.
- `formatMode`: input falsy → `null`; otherwise today's mapping with the same
  `?? null` / `?? 0` fallbacks.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Rewire `src/server.ts`

In both handlers, replace the local `fetchJson` copies and moved logic with
imports from `./chess-com.js`. Resulting handler shapes:

- `get-chess-player`: `Promise.all([fetchProfile(handle), fetchStats(handle)])`;
  not-found return unchanged; `player` object built from the typed `Profile`/
  `Stats` (the `profile.country` → `String(...).split("/").pop()` and all
  `?? null` / `?? 0` fallbacks keep identical behavior); `formatMode` imported.
- `get-last-game`: `fetchArchiveUrls(handle)` → empty ⇒ `notFound`;
  `fetchArchiveGames(last url)` → last game or `notFound`; then
  `pgnTag(pgn, "ECOUrl")` / `pgnTag(pgn, "Termination")`,
  `extractOpening(...)`, `buildReplay(pgn)`, `mapGameResult(me?.result)`.
  Keep the `isWhite` / `me` / `opponent` selection and the summary string
  construction in the handler, unchanged.

Delete the now-unused local helpers. `import { Chess } from "chess.js"` moves
out of server.ts (only `chess-com.ts` needs it).

**Verify**: `npx tsc --noEmit` → exit 0, and
`grep -c "fetchJson" src/server.ts` → `0`, and
`grep -c ": any" src/server.ts` → `0`.

### Step 3: Write `src/chess-com.test.ts`

Model after `src/views/get-last-game/lib.test.ts` (from plan 003). Cover:

- `mapGameResult`: `"win"` → win; each of the six draw codes → draw;
  `"checkmated"`, `"timeout"`, `"resigned"`, `undefined` → loss.
- `pgnTag`: extracts from `[ECOUrl "https://x/y"]`; returns null when absent;
  picks the named tag when multiple tags exist.
- `extractOpening`:
  `"https://www.chess.com/openings/Sicilian-Defense-Open"` →
  `"Sicilian Defense Open"`; URL-encoded segment decodes; `null` → `null`;
  URL ending in `/` → `null` (empty segment falls through `|| null`).
- `buildReplay`: PGN `"1. e4 e5 2. Nf3 *"` → `moves` equals
  `["e4", "e5", "Nf3"]` and `positions.length === 4` with
  `positions[0]` the start FEN; garbage input (`"not a pgn"` does not throw)
  → if chess.js accepts it as empty, expect `moves` `[]`; the function must
  never throw.
- `formatMode`: `undefined` → null; full object maps through; object with
  missing `record` → zeros.
- Schema leniency: `profileSchema.safeParse` succeeds on an object with extra
  unknown keys and missing optional keys.

**Verify**: `pnpm test` → exit 0, all tests (old + new) pass.

### Step 4: Build and smoke test

**Verify**: `pnpm build` → exit 0. Then `pnpm dev`, DevTools UI: call both
tools with `magnuscarlsen` (cards render, replay steps) and with
`this-user-does-not-exist-xyz123` (clean not-found states). If DevTools is
unavailable in your environment, say so and rely on tests + build.

## Test plan

See Step 3 — `src/chess-com.test.ts`, ≥ 16 cases, modeled structurally on
`src/views/get-last-game/lib.test.ts`. Verification: `pnpm test` exits 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/chess-com.ts` and `src/chess-com.test.ts` exist
- [ ] `grep -c "fetchJson" src/server.ts` prints `0`
- [ ] `grep -c ": any" src/server.ts src/chess-com.ts` prints `0` for both
- [ ] `grep -c "from \"chess.js\"" src/server.ts` prints `0`
- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm test` exits 0 (existing lib tests still pass)
- [ ] `pnpm build` exits 0
- [ ] `git status --short` shows only in-scope files modified (plus
      `plans/README.md` if you update the index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm test` does not exist / fails before you start — plan 003 has not
  landed; this plan depends on it.
- The two `fetchJson` copies in `src/server.ts` differ from each other.
- Preserving an invariant (summary text, structuredContent shape) would
  require changing an out-of-scope config block.
- chess.js's `loadPgn` behavior differs from the description (e.g. throws on
  the happy-path test PGN) — report actual behavior with the version from
  pnpm-lock.yaml.
- zod v4 API differs from the sketched schema calls (e.g. `nullish` missing)
  — report rather than substituting looser typing.

## Maintenance notes

- New chess.com endpoints (e.g. a future daily-puzzle or recent-games tool)
  belong in `src/chess-com.ts` with the same lenient-schema pattern.
- Reviewer should scrutinize: schema leniency (a required field that
  chess.com sometimes omits would turn valid lookups into not-found) and
  byte-identical summary strings.
- Deferred: response caching per username, retry on 429 — revisit only if
  traffic warrants.
