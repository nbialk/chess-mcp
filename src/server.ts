// Cloud Run injects PORT; Skybridge listens on __PORT. Bridge them before the
// server reads its listen port.
if (process.env.PORT && !process.env.__PORT) {
  process.env.__PORT = process.env.PORT;
}

import { readFile } from "node:fs/promises";
import { Chess } from "chess.js";
import { McpServer } from "skybridge/server";
import { z } from "zod";
import { captureToolCall, shutdownAnalytics } from "./analytics.js";

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
  positions: z.array(z.string()),
  moves: z.array(z.string()),
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

      if (!profile) {
        return {
          structuredContent: { found: false, username: handle },
          content: [
            { type: "text", text: `No Chess.com player found for "${username}".` },
          ],
          isError: true,
        };
      }

      const formatMode = (mode: any) =>
        mode
          ? {
              rating: mode.last?.rating ?? null,
              best: mode.best?.rating ?? null,
              win: mode.record?.win ?? 0,
              loss: mode.record?.loss ?? 0,
              draw: mode.record?.draw ?? 0,
            }
          : null;

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
      const archiveUrls: string[] = archives?.archives ?? [];
      if (archiveUrls.length === 0) return notFound;

      const month = await fetchJson(archiveUrls[archiveUrls.length - 1]);
      const games: any[] = month?.games ?? [];
      const game = games[games.length - 1];
      if (!game) return notFound;

      const pgn: string = game.pgn ?? "";
      const tag = (name: string) =>
        pgn.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? null;

      const ecoUrl = tag("ECOUrl");
      const opening = ecoUrl
        ? decodeURIComponent(ecoUrl.split("/").pop() ?? "")
            .replace(/-/g, " ")
            .trim() || null
        : null;

      let positions: string[] = [];
      let moves: string[] = [];
      try {
        const chess = new Chess();
        chess.loadPgn(pgn);
        const history = chess.history();
        const replay = new Chess();
        positions = [replay.fen()];
        for (const san of history) {
          replay.move(san);
          positions.push(replay.fen());
          moves.push(san);
        }
      } catch {
        positions = [];
        moves = [];
      }

      const isWhite = game.white?.username?.toLowerCase() === handle;
      const me = isWhite ? game.white : game.black;
      const opponent = isWhite ? game.black : game.white;

      const drawResults = [
        "agreed",
        "repetition",
        "stalemate",
        "insufficient",
        "50move",
        "timevsinsufficient",
      ];
      const result: "win" | "draw" | "loss" =
        me?.result === "win"
          ? "win"
          : drawResults.includes(me?.result)
            ? "draw"
            : "loss";

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
        termination: tag("Termination"),
        url: game.url ?? null,
        positions,
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
        isError: false,
      };
    },
  );

server.mcpMiddleware("tools/call", async (request, extra, next) => {
  const start = Date.now();
  const tool = String(request.params?.name ?? "unknown");
  const args = request.params?.arguments as Record<string, unknown> | undefined;
  const distinctId = extra?.sessionId;

  try {
    const result = await next();
    captureToolCall({
      tool,
      durationMs: Date.now() - start,
      success: result?.isError !== true,
      distinctId,
      properties: { username: args?.username ?? null },
    });
    return result;
  } catch (err) {
    captureToolCall({
      tool,
      durationMs: Date.now() - start,
      success: false,
      distinctId,
      properties: { username: args?.username ?? null, error: String(err) },
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
