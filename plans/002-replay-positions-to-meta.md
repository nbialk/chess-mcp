# Plan 002: Stop shipping the full FEN replay list into the model's context

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ded809d..HEAD -- src/server.ts src/views/get-last-game/index.tsx`
> Plan 001 also edits `src/server.ts` (fetch hardening + `isError` changes);
> that drift is **expected and fine**. Any drift in the specific excerpts
> below (outputSchema, `lastGame` object, the tool's return statement, the
> view's `positions` wiring) is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (recommended after plans/001-harden-chesscom-fetches.md
  to avoid merge friction in `src/server.ts`)
- **Category**: perf
- **Planned at**: commit `ded809d`, 2026-06-11

## Why this matters

The `get-last-game` tool returns the **entire board replay** — one FEN string
(~60 chars) per half-move — inside `structuredContent`. In MCP apps,
`structuredContent` is read by the model on every call: an 80-ply game adds
roughly 5 KB / 1.3k tokens of FEN noise to the conversation context, and long
games add 3k+. The model gains nothing from raw FEN lists; only the React view
uses them. Moving `positions` to the tool result's `_meta` (which Skybridge
delivers to the view as `responseMetadata` but hides from the model) removes
that cost on every production call. The SAN `moves` list stays in
`structuredContent` deliberately — it is compact and lets the model actually
discuss the game.

## Current state

- `src/server.ts` — defines the `get-last-game` tool: output zod schema,
  result assembly, return statement.
- `src/views/get-last-game/index.tsx` — the replay view; reads
  `output.game.positions` today.

The repo already uses this exact `_meta`/`responseMetadata` pattern: the
`get-chess-player` tool returns `_meta: { avatar: profile.avatar ?? null }`
(src/server.ts:182) and the view reads it via
`const avatar = responseMetadata?.avatar;` (src/views/get-chess-player.tsx:141).
Match that pattern.

Typing facts (verified against the installed `skybridge@1.0.x`):

- The view-side `output` type is inferred from the handler's returned
  `structuredContent` literal, NOT from `outputSchema`. The `responseMetadata`
  type is inferred from the handler's `_meta` literal. Both flow through
  `generateHelpers<AppType>()` in `src/helpers.ts`.
- `outputSchema` IS used by the MCP SDK for **runtime validation** of
  `structuredContent` — so the schema and the returned object must change in
  lockstep or every call fails validation at runtime.

Excerpt 1 — output schema (src/server.ts:45-59):

```ts
const lastGameSchema = z.object({
  result: z.enum(["win", "draw", "loss"]),
  // ... other fields ...
  url: z.string().nullable(),
  positions: z.array(z.string()),
  moves: z.array(z.string()),
});
```

Excerpt 2 — result assembly and return (src/server.ts:303-339, abridged):

```ts
const lastGame = {
  result,
  color: isWhite ? "white" : "black",
  // ... other fields ...
  url: game.url ?? null,
  positions,
  moves,
};
// ...
return {
  structuredContent: {
    found: true as const,
    username: handle,
    game: lastGame,
  },
  content: [{ type: "text", text: summary }],
  isError: false,
};
```

Excerpt 3 — view wiring (src/views/get-last-game/index.tsx:23-27):

```tsx
const { input, output, isPending } = useToolInfo<"get-last-game">();
const openExternal = useOpenExternal();

const game = output?.found ? output.game : undefined;
const positions = game?.positions ?? [];
```

The view uses `positions` in three places after that: `maxPly` computation
(index.tsx:32), the board render `<Board fen={positions[current]} ...>`
(index.tsx:131), and two `positions.length` layout branches (index.tsx:121,
:224, :242).

## Commands you will need

| Purpose            | Command           | Expected on success                          |
|--------------------|-------------------|----------------------------------------------|
| Install            | `pnpm install`    | exit 0                                        |
| Build + typecheck  | `pnpm build`      | exit 0 (runs `tsc -b --force`, then Vite)     |
| Typecheck only     | `npx tsc --noEmit`| exit 0, no output                             |
| Manual smoke test  | `pnpm dev`        | DevTools UI at http://localhost:3000          |

## Scope

**In scope** (the only files you should modify):
- `src/server.ts` (only the `get-last-game` schema/return)
- `src/views/get-last-game/index.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `moves` stays in `structuredContent` — do not move it to `_meta`.
- `src/views/get-last-game/board.tsx`, `moves-panel.tsx`, `player-bar.tsx`,
  `lib.ts` — props are unchanged.
- The `get-chess-player` tool and view — its `_meta.avatar` is the exemplar,
  not a change target.

## Git workflow

- Branch: `advisor/002-replay-positions-to-meta`
- Conventional Commits. Suggested message:
  `perf(server): move board replay positions to _meta to cut model context`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove `positions` from the output schema

In `lastGameSchema` (Excerpt 1), delete the line
`positions: z.array(z.string()),`. Keep `moves`.

**Verify**: `grep -n "positions" src/server.ts` → no hit inside
`lastGameSchema` (hits remain in the handler body for now).

### Step 2: Move `positions` from `structuredContent` to `_meta`

In the `get-last-game` handler:

1. In the `lastGame` object (Excerpt 2), delete the `positions,` line. Keep
   `moves,`.
2. In the success `return`, add a `_meta` field carrying the positions,
   following the `get-chess-player` pattern at src/server.ts:182:

```ts
return {
  structuredContent: {
    found: true as const,
    username: handle,
    game: lastGame,
  },
  content: [{ type: "text", text: summary }],
  _meta: { positions },
  isError: false,
};
```

The not-found path needs no change (it never carried `positions`).

**Verify**: `npx tsc --noEmit` → exit 0. Then
`grep -n "_meta: { positions }" src/server.ts` → exactly 1 hit.

### Step 3: Read positions from `responseMetadata` in the view

In `src/views/get-last-game/index.tsx` (Excerpt 3):

1. Destructure `responseMetadata` from the hook:

```tsx
const { input, output, isPending, responseMetadata } =
  useToolInfo<"get-last-game">();
```

2. Replace the `positions` line:

```tsx
const positions = responseMetadata?.positions ?? [];
```

`responseMetadata.positions` is typed `string[]` automatically from the
handler's `_meta` literal. If TypeScript reports it as `unknown` instead,
the `AppType` inference chain broke — that is a STOP condition, not a place
for an `as` cast.

No other view changes: `maxPly`, `Board fen={positions[current]}`, and the
`positions.length` branches keep working off the new local.

**Verify**: `npx tsc --noEmit` → exit 0. Then
`grep -n "game?.positions\|game.positions" src/views/get-last-game/index.tsx`
→ no matches.

### Step 4: Build and smoke test

**Verify**: `pnpm build` → exit 0.

Then run `pnpm dev`, open http://localhost:3000, call `get-last-game` with
username `magnuscarlsen` in the DevTools UI and confirm:

- The board renders and the move navigation (first/prev/play/next/last)
  steps through positions.
- The tool's structured output shown by DevTools contains `moves` but NOT
  `positions`.

If the DevTools UI is unavailable in your environment, note that in your
report and rely on the build + grep gates.

## Test plan

No test runner exists yet (plan 003 introduces Vitest); the type-level gates
are strong here because `output`/`responseMetadata` types are inferred from
the handler. After plan 003 lands, no extra unit test is required for this
change — it is wiring, not logic.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "positions: z.array" src/server.ts` prints `0`
- [ ] `grep -c "_meta: { positions }" src/server.ts` prints `1`
- [ ] `grep -c "responseMetadata" src/views/get-last-game/index.tsx` prints
      at least `2` (destructure + read)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `git status --short` shows only the two in-scope files modified (plus
      `plans/README.md` if you update the index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match the live code (beyond plan 001's expected changes
  to `fetchJson`/`isError` in the same file).
- `responseMetadata.positions` types as `unknown`/`any` in the view —
  the Skybridge `_meta` type inference assumption is false; report rather
  than casting.
- The DevTools smoke test shows the board empty or stuck on the start
  position while `moves` render — `_meta` is not reaching the view in this
  host; report which host/bridge you tested with.
- The runtime rejects the tool result with an output-schema validation error
  — schema and returned object drifted apart; re-check Steps 1–2 once, then
  stop.

## Maintenance notes

- Anyone adding new view-only payloads (e.g. per-move clocks, eval bars)
  should follow this `_meta` route, not `structuredContent`.
- Reviewer should scrutinize: `outputSchema` and the returned
  `structuredContent` stayed in lockstep, and `moves` intentionally remained
  model-visible.
- Deferred option (rejected for now): computing positions client-side from
  `moves` with chess.js in the iframe — saves wire bytes too, but adds
  ~100 KB to the view bundle and duplicates replay logic.
