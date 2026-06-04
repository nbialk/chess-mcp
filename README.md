# chess-mcp

An MCP / ChatGPT App that looks up Chess.com player stats and recent games, built with the [Skybridge](https://docs.skybridge.tech) framework.

**Live demo:** [chess.niklas.sh](https://chess.niklas.sh/)

## Tools

- **get-chess-player** — Look up a Chess.com player by username and show their profile and game statistics (rapid, blitz, bullet ratings and win/loss records).
- **get-last-game** — Look up a player's most recent game with result, opponent, opening, and an interactive board replay.

## Getting Started

### Prerequisites

- Node.js 24+

### Local Development

#### 1. Install

```bash
pnpm install
```

#### 2. Start the dev server

```bash
pnpm dev
```

This command starts:
- The MCP server at `http://localhost:3000/mcp`.
- Skybridge DevTools UI at `http://localhost:3000`.

#### 3. Project structure

```
├── src/
│   ├── server.ts         # Server entry point and tool definitions
│   ├── views/            # React components (one per view)
│   ├── components/       # Shared UI components
│   ├── helpers.ts        # Shared utilities
│   └── index.css         # Global styles
├── vite.config.ts
├── Dockerfile
└── package.json
```

### Testing your App

Test the app locally using the DevTools UI at `http://localhost:3000` while running `pnpm dev`.

To connect with web clients like ChatGPT or Claude, expose your server with the `--tunnel` flag (`pnpm dev:tunnel`). See the [test guide](https://docs.skybridge.tech/quickstart/test-your-app).

## Deploy

Skybridge is infrastructure agnostic and can be deployed on any cloud platform supporting MCP. A `Dockerfile` is included for container-based deployments (e.g. Google Cloud Run).

```bash
pnpm build
```

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [MCP Apps Documentation](https://github.com/modelcontextprotocol/ext-apps/tree/main)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)

## License

[MIT](./LICENSE)
