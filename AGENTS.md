# AGENTS.md

This is a ChatGPT/MCP app built with [Skybridge](https://docs.skybridge.tech)
(MCP server + one React view per tool). It looks up Chess.com players and
games via the chess.com public API.

## Commands

- `pnpm install` — install dependencies (pnpm 9, Node 24).
- `pnpm dev` — MCP server at http://localhost:3000/mcp + DevTools UI at
  http://localhost:3000 (use the DevTools UI to invoke tools manually).
- `pnpm build` — typechecks (`tsc -b`) and builds server + views. Primary
  verification gate.
- `pnpm test` — Vitest unit tests.
- `pnpm lint` — ESLint (flat config).
- `pnpm typecheck` — `tsc --noEmit`.

## Structure

- `src/server.ts` — server entry: tool definitions (zod schemas), analytics
  middleware, asset routes.
- `src/chess-com.ts` — typed chess.com API client: fetchers with a zod
  boundary plus pure helpers (result mapping, PGN parsing, replay building).
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
- New chess.com calls belong in `src/chess-com.ts` behind a zod schema, not
  inline in `src/server.ts`.
- Conventional Commits (`feat(server): …`, `fix(views): …`). Releases are
  cut by release-please; merging the release PR deploys to Cloud Run.
- Never commit, push, or open PRs unless explicitly asked.
