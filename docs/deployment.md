# Deployment & Analytics

## Analytics

Tool calls can be tracked with [PostHog](https://posthog.com). Tracking is
wired as MCP middleware in [`src/server.ts`](../src/server.ts) and is a **no-op**
unless `POSTHOG_API_KEY` is set, so forks and local development send no events.

Copy [`.env.example`](../.env.example) to `.env` and set the keys to enable it locally:

```bash
cp .env.example .env
```

Use the PostHog **Project** API Key (`phc_...`), never a Personal API Key. No
key value is ever committed — only read from the environment.

## Deployment

Deployments target [**Google Cloud Run**](https://cloud.google.com/run) and are
driven by SemVer release tags. CI (lint, typecheck, build, test) runs on every
PR via [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Release flow

1. Land changes on `main` using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major).
2. [`release-please`](https://github.com/googleapis/release-please) opens a
   release PR with the version bump and [`CHANGELOG.md`](../CHANGELOG.md), driven
   by [`release-please-config.json`](../release-please-config.json).
3. Merging that PR creates a `vX.Y.Z` tag and GitHub Release.
4. The `deploy` job in
   [`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml)
   then builds the [`Dockerfile`](../Dockerfile) image, pushes it to
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
