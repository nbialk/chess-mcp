import { Chess } from "chess.js";
import { McpServer } from "skybridge/server";
import { z } from "zod";

const server = new McpServer(
  {
    name: "chess-app",
    version: "0.0.1",
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
      annotations: {
        title: "Get Chess.com player stats",
        readOnlyHint: true,
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
      annotations: {
        title: "Get Chess.com last game",
        readOnlyHint: true,
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

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

export default await server.run();

export type AppType = typeof server;
