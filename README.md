<p align="center">
  <img src="./public/demo-banner.png" alt="chess-mcp demo" />
</p>

<p align="center">
  <a href="https://docs.skybridge.tech"><img src="https://img.shields.io/badge/Skybridge-1.0.4-2563eb?style=flat-square&logo=react&logoColor=white" alt="Skybridge" /></a>
  <a href="https://chess.niklas.sh"><img src="https://img.shields.io/badge/Demo-chess.niklas.sh-7c3aed?style=flat-square&logo=lichess&logoColor=white" alt="Live demo" /></a>
</p>

A [Skybridge](https://docs.skybridge.tech) MCP app that looks up Chess.com
players, games, and the daily puzzle — each tool ships with its own interactive
React view.

## Contents

- [Tools](#tools)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Analytics](#analytics)
- [Deployment](#deployment)
- [Resources](#resources)
- [License](#license)

## Tools

| Tool | Input | Description |
| --- | --- | --- |
| **get-chess-player** | `username` | Player profile with rapid, blitz, and bullet ratings plus win/loss/draw records. |
| **get-last-game** | `username` | The player's most recent game — result, opponent, opening, and an interactive board replay. |
| **get-daily-puzzle** | _none_ | The Chess.com daily puzzle as an interactive board: solve it move by move with live feedback, reveal the solution, or reset and retry. |

## Getting Started

### Prerequisites

- Node.js 24.14.1+
- pnpm 9+

### Install

```bash
pnpm install
```

### Start the dev server

```bash
pnpm dev
```

This starts:

- The MCP server at `http://localhost:3000/mcp`.
- The Skybridge DevTools UI at `http://localhost:3000`.

All scripts (`dev`, `build`, `test`, `lint`, `typecheck`) are defined in
[`package.json`](./package.json).

## Project Structure

```
├── src/
│   ├── server.ts         # Server entry: tool definitions + analytics middleware
│   ├── chess-com.ts      # Typed Chess.com API client (zod boundary + helpers)
│   ├── analytics.ts      # PostHog wrapper (no-op without a key)
│   ├── helpers.ts        # Typed useToolInfo / useCallTool hooks
│   ├── views/            # One React view per tool
│   │   └── shared/       # Shared view code (chess board, helpers)
│   └── index.css         # Global styles
├── vite.config.ts        # Vite + Skybridge + Tailwind config
├── Dockerfile            # Cloud Run image
└── package.json
```

## Testing

Test the app locally using the DevTools UI at `http://localhost:3000` while running `pnpm dev`.

Unit tests run with [Vitest](https://vitest.dev): `pnpm test`.

To connect with web clients like ChatGPT or Claude, expose your server with the `--tunnel` flag (`pnpm dev:tunnel`). See the [test guide](https://docs.skybridge.tech/quickstart/test-your-app).

## Analytics

Tool calls can be tracked with [PostHog](https://posthog.com). Tracking is
wired as MCP middleware in [`src/server.ts`](./src/server.ts) and is a **no-op**
unless `POSTHOG_API_KEY` is set, so forks and local development send no events.

Copy [`.env.example`](./.env.example) to `.env` and set the keys to enable it locally:

```bash
cp .env.example .env
```

Use the PostHog **Project** API Key (`phc_...`), never a Personal API Key. No
key value is ever committed — only read from the environment.

## Deployment

Deployments target [**Google Cloud Run**](https://cloud.google.com/run) and are
driven by SemVer release tags. CI (lint, typecheck, build, test) runs on every
PR via [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

### Release flow

1. Land changes on `main` using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major).
2. [`release-please`](https://github.com/googleapis/release-please) opens a
   release PR with the version bump and [`CHANGELOG.md`](./CHANGELOG.md), driven
   by [`release-please-config.json`](./release-please-config.json).
3. Merging that PR creates a `vX.Y.Z` tag and GitHub Release.
4. The `deploy` job in
   [`.github/workflows/release-please.yml`](./.github/workflows/release-please.yml)
   then builds the [`Dockerfile`](./Dockerfile) image, pushes it to
   [Artifact Registry](https://cloud.google.com/artifact-registry) (tagged
   `X.Y.Z` and `latest`), and deploys to Cloud Run.

### One-time GCP setup

- Enable APIs: `run`, `cloudbuild`, `artifactregistry`, `iamcredentials`,
  `secretmanager`.
- Create an Artifact Registry Docker repo named `chess-mcp`.
- Set up [Workload Identity Federation](https://github.com/google-github-actions/auth#preferred-direct-workload-identity-federation)
  for GitHub Actions and a service account with roles `run.admin`,
  `artifactregistry.writer`, `iam.serviceAccountUser`, and
  `secretmanager.secretAccessor`.
- Store the PostHog project key in Secret Manager as `posthog-api-key`.

### GitHub configuration

Repository **secrets**: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`,
`GCP_SERVICE_ACCOUNT`.

Repository **variables**: `GCP_REGION`, `POSTHOG_HOST` (e.g.
`https://eu.i.posthog.com`).

### Custom domain

The service is mapped to `mcp.chess.niklas.sh` via Cloud Run domain mapping
(managed TLS is provisioned automatically):

```bash
gcloud beta run domain-mappings create \
  --service chess-mcp \
  --domain mcp.chess.niklas.sh \
  --region "$GCP_REGION"
```

Then add the DNS records that the command prints to your DNS provider (a
`CNAME` to `ghs.googlehosted.com.`). Certificate provisioning can take from a
few minutes up to 24 hours.

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [MCP Apps Documentation](https://github.com/modelcontextprotocol/ext-apps/tree/main)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)

## License

The source code is released under the [Beerware License](./LICENSE).

The chess piece icons are from the ["Chess" pack on Flaticon](https://www.flaticon.com/packs/chess-75) and are used under the Flaticon Free License — they are not covered by the Beerware license. See [NOTICE](./NOTICE) for details.
