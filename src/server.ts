// Cloud Run injects PORT; Skybridge listens on __PORT. Bridge them before the
// server reads its listen port.
if (process.env.PORT && !process.env.__PORT) {
  process.env.__PORT = process.env.PORT;
}

import { readFile } from "node:fs/promises";
import { McpServer } from "skybridge/server";
import { z } from "zod";
import {
  captureMcpRequest,
  identifyClient,
  shutdownAnalytics,
} from "./analytics.js";
import { buildPuzzleSolution, fetchDailyPuzzle } from "./chess-com.js";
import {
  buildReplay,
  extractOpening,
  fetchArchiveGames,
  fetchArchiveUrls,
  fetchProfile,
  fetchStats,
  formatMode,
  mapGameResult,
  pgnTag,
} from "./chess-com.js";

const modeSchema = z
  .object({
    rating: z.number().nullable(),
    best: z.number().nullable(),
    win: z.number(),
    loss: z.number(),
    draw: z.number(),
  })
  .nullable();

const playerSchema = z.object({
  username: z.string(),
  name: z.string().nullable(),
  title: z.string().nullable(),
  country: z.string().nullable(),
  location: z.string().nullable(),
  followers: z.number(),
  status: z.string().nullable(),
  league: z.string().nullable(),
  joined: z.number().nullable(),
  lastOnline: z.number().nullable(),
  url: z.string(),
  fide: z.number().nullable(),
  rapid: modeSchema,
  blitz: modeSchema,
  bullet: modeSchema,
});

const lastGameSchema = z.object({
  result: z.enum(["win", "draw", "loss"]),
  color: z.enum(["white", "black"]),
  userRating: z.number().nullable(),
  opponent: z.string().nullable(),
  opponentRating: z.number().nullable(),
  timeClass: z.string().nullable(),
  rated: z.boolean().nullable(),
  endTime: z.number().nullable(),
  opening: z.string().nullable(),
  termination: z.string().nullable(),
  url: z.string().nullable(),
  moves: z.array(z.string()),
});

const puzzleSchema = z.object({
  title: z.string(),
  url: z.string(),
  fen: z.string(),
  image: z.string(),
  sideToMove: z.enum(["w", "b"]),
  solution: z.array(
    z.object({
      san: z.string(),
      from: z.string(),
      to: z.string(),
      promotion: z.string().optional(),
    }),
  ),
});

const server = new McpServer(
  {
    name: "chess-app",
    title: "Chess MCP",
    version: process.env.APP_VERSION ?? "0.0.0",
    websiteUrl: "https://mcp.chess.niklas.sh",
    icons: [
      {
        src: "https://mcp.chess.niklas.sh/icon.png",
        mimeType: "image/png",
        sizes: ["500x500"],
      },
    ],
  },
  { capabilities: {} },
)
  .registerTool(
    {
      name: "get-chess-player",
      description:
        "Look up a Chess.com player by username and show their profile and game statistics (rapid, blitz, bullet ratings and win/loss records).",
      inputSchema: {
        username: z
          .string()
          .default("magnuscarlsen")
          .describe("The Chess.com username to look up. Default: magnuscarlsen."),
      },
      outputSchema: {
        found: z.boolean(),
        username: z.string().optional(),
        player: playerSchema.optional(),
      },
      annotations: {
        title: "Get Chess.com player stats",
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Fetching player stats from Chess.com…",
        "openai/toolInvocation/invoked": "Player stats ready.",
      },
      view: {
        component: "get-chess-player",
        description: "Chess.com player stats card",
        csp: {
          resourceDomains: ["https://images.chesscomfiles.com"],
          redirectDomains: ["https://www.chess.com"],
        },
      },
    },
    async ({ username }) => {
      const handle = username.trim().toLowerCase();

      const [profile, stats] = await Promise.all([
        fetchProfile(handle),
        fetchStats(handle),
      ]);

      if (!profile) {
        return {
          structuredContent: { found: false, username: handle },
          content: [
            { type: "text", text: `No Chess.com player found for "${username}".` },
          ],
          isError: false,
        };
      }

      const player = {
        username: profile.username,
        name: profile.name ?? null,
        title: profile.title ?? null,
        country: profile.country
          ? String(profile.country).split("/").pop()
          : null,
        location: profile.location ?? null,
        followers: profile.followers ?? 0,
        status: profile.status ?? null,
        league: profile.league ?? null,
        joined: profile.joined ?? null,
        lastOnline: profile.last_online ?? null,
        url: profile.url ?? `https://www.chess.com/member/${handle}`,
        fide: stats?.fide ?? null,
        rapid: formatMode(stats?.chess_rapid),
        blitz: formatMode(stats?.chess_blitz),
        bullet: formatMode(stats?.chess_bullet),
      };

      const summary = [
        `${player.title ? `${player.title} ` : ""}${player.name ?? player.username} (@${player.username})`,
        player.blitz ? `Blitz ${player.blitz.rating}` : null,
        player.rapid ? `Rapid ${player.rapid.rating}` : null,
        player.bullet ? `Bullet ${player.bullet.rating}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        structuredContent: { found: true, player },
        content: [{ type: "text", text: summary }],
        _meta: { avatar: profile.avatar ?? null },
        isError: false,
      };
    },
  )
  .registerTool(
    {
      name: "get-last-game",
      description:
        "Look up a Chess.com player's most recent game and show the result, opponent, opening, and how the game ended.",
      inputSchema: {
        username: z
          .string()
          .default("magnuscarlsen")
          .describe("The Chess.com username to look up. Default: magnuscarlsen."),
      },
      outputSchema: {
        found: z.boolean(),
        username: z.string().optional(),
        game: lastGameSchema.optional(),
      },
      annotations: {
        title: "Get Chess.com last game",
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Fetching the last game from Chess.com…",
        "openai/toolInvocation/invoked": "Last game ready.",
      },
      view: {
        component: "get-last-game",
        description: "Chess.com last game card",
        csp: {
          redirectDomains: ["https://www.chess.com"],
        },
      },
    },
    async ({ username }) => {
      const handle = username.trim().toLowerCase();

      const notFound = {
        structuredContent: { found: false as const, username: handle },
        content: [
          {
            type: "text" as const,
            text: `No recent Chess.com game found for "${username}".`,
          },
        ],
        isError: false,
      };

      const archiveUrls = await fetchArchiveUrls(handle);
      if (archiveUrls.length === 0) return notFound;

      const games = await fetchArchiveGames(archiveUrls[archiveUrls.length - 1]);
      const game = games[games.length - 1];
      if (!game) return notFound;

      const pgn = game.pgn ?? "";

      const opening = extractOpening(pgnTag(pgn, "ECOUrl"));
      const { positions, moves } = buildReplay(pgn);

      const isWhite = game.white?.username?.toLowerCase() === handle;
      const me = isWhite ? game.white : game.black;
      const opponent = isWhite ? game.black : game.white;

      const result = mapGameResult(me?.result);

      const lastGame = {
        result,
        color: isWhite ? "white" : "black",
        userRating: me?.rating ?? null,
        opponent: opponent?.username ?? null,
        opponentRating: opponent?.rating ?? null,
        timeClass: game.time_class ?? null,
        rated: game.rated ?? null,
        endTime: game.end_time ?? null,
        opening,
        termination: pgnTag(pgn, "Termination"),
        url: game.url ?? null,
        moves,
      };

      const resultLabel =
        result === "win" ? "Win" : result === "draw" ? "Draw" : "Loss";
      const summary = [
        `${resultLabel} vs @${lastGame.opponent}${lastGame.opponentRating ? ` (${lastGame.opponentRating})` : ""}`,
        lastGame.timeClass
          ? lastGame.timeClass[0].toUpperCase() + lastGame.timeClass.slice(1)
          : null,
        lastGame.opening,
      ]
        .filter(Boolean)
        .join(" · ");

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
    },
  )
  .registerTool(
    {
      name: "get-daily-puzzle",
      description:
        "Get the Chess.com daily puzzle as an interactive board to solve. Returns the starting position, the side to move, and the solution line so the player can attempt the moves and get feedback.",
      inputSchema: {},
      outputSchema: {
        found: z.boolean(),
        puzzle: puzzleSchema.optional(),
      },
      annotations: {
        title: "Get Chess.com daily puzzle",
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        "openai/toolInvocation/invoking":
          "Fetching the daily puzzle from Chess.com…",
        "openai/toolInvocation/invoked": "Daily puzzle ready.",
      },
      view: {
        component: "get-daily-puzzle",
        description: "Chess.com daily puzzle solver",
        csp: {
          resourceDomains: ["https://www.chess.com"],
          redirectDomains: ["https://www.chess.com"],
        },
      },
    },
    async () => {
      const puzzle = await fetchDailyPuzzle();

      if (!puzzle) {
        return {
          structuredContent: { found: false as const },
          content: [
            {
              type: "text",
              text: "Could not fetch the Chess.com daily puzzle.",
            },
          ],
          isError: true,
        };
      }

      const sideToMove = puzzle.fen.split(" ")[1] === "b" ? "b" : "w";
      const solution = buildPuzzleSolution(puzzle.fen, puzzle.pgn);

      const summary = [
        `Daily puzzle: ${puzzle.title}`,
        `${sideToMove === "w" ? "White" : "Black"} to move`,
        solution.length > 0 ? `${solution.length}-move solution` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        structuredContent: {
          found: true as const,
          puzzle: {
            title: puzzle.title,
            url: puzzle.url,
            fen: puzzle.fen,
            image: puzzle.image,
            sideToMove,
            solution,
          },
        },
        content: [{ type: "text", text: summary }],
        isError: false,
      };
    },
  );

server.mcpMiddleware(async (request, extra, next) => {
  const start = Date.now();
  const method = request.method;
  const distinctId = extra?.sessionId;

  // Build method-specific properties (e.g. tool name + args for tools/call).
  const properties: Record<string, unknown> = {};
  if (method === "tools/call") {
    const params = request.params as
      | { name?: unknown; arguments?: Record<string, unknown> }
      | undefined;
    properties.tool = params?.name ?? null;
    properties.username = params?.arguments?.username ?? null;
  }

  // On initialize, attach the MCP client identity to the session.
  if (method === "initialize" && distinctId) {
    const clientInfo = (request.params as { clientInfo?: unknown } | undefined)
      ?.clientInfo as { name?: string; version?: string } | undefined;
    identifyClient(distinctId, clientInfo?.name ?? null, clientInfo?.version ?? null);
  }

  try {
    const result = await next();
    const isError =
      typeof result === "object" &&
      result !== null &&
      (result as { isError?: unknown }).isError === true;
    captureMcpRequest({
      method,
      durationMs: Date.now() - start,
      success: !isError,
      distinctId,
      properties,
    });
    return result;
  } catch (err) {
    captureMcpRequest({
      method,
      durationMs: Date.now() - start,
      success: false,
      distinctId,
      properties: { ...properties, error: String(err) },
    });
    throw err;
  }
});

type AssetResponse = {
  status(code: number): { end(): void };
  set(field: string, value: string): void;
  send(body: Buffer): void;
};

const serveAsset = (route: string, file: string, contentType: string) => {
  const assetUrl = new URL(`./assets/${file}`, import.meta.url);
  const assetPromise = readFile(assetUrl).catch(() => null);
  server.express.get(route, async (_req: unknown, res: AssetResponse) => {
    const asset = await assetPromise;
    if (!asset) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(asset);
  });
};

// Serve a favicon and app icon so MCP clients (e.g. Claude) show the app icon
// instead of falling back to the root domain's favicon. The icon is referenced
// from `serverInfo.icons` and must be a PNG for broad client support.
serveAsset("/favicon.ico", "favicon.ico", "image/x-icon");
serveAsset("/icon.png", "icon.png", "image/png");

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

// Flush buffered analytics on shutdown so Cloud Run container stops don't drop
// events.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdownAnalytics().finally(() => process.exit(0));
  });
}

export default await server.run();

export type AppType = typeof server;
