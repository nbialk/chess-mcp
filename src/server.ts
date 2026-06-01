import { McpServer } from "skybridge/server";
import { z } from "zod";

const server = new McpServer(
  {
    name: "alpic-openai-app",
    version: "0.0.1",
  },
  { capabilities: {} },
)
  .registerTool(
    {
      name: "start",
      description: "Onboard Skybridge",
      inputSchema: {
        name: z.string().optional().describe("The user name."),
      },
      annotations: {
        title: "Start Skybridge onboarding",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Starting the Skybridge onboarding…",
        "openai/toolInvocation/invoked": "Onboarding ready.",
      },
      view: {
        component: "onboarding",
        // Replace with the URL your widget will be served from in production.
        domain: "https://skybridge.tech",
        description: "Onboarding deck",
        csp: {
          resourceDomains: [
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
          ],
          redirectDomains: ["https://docs.skybridge.tech"],
        },
      },
    },
    async ({ name }) => {
      return {
        structuredContent: { name },
        content: [{ type: "text", text: `User name: ${name ?? "friend"}` }],
        isError: false,
      };
    },
  )
  .registerTool(
    {
      name: "get-fortune-cookie",
      description: "Get fortune cookie",
      annotations: {
        title: "Get a fortune cookie",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Cracking open a fortune cookie…",
        "openai/toolInvocation/invoked": "Fortune revealed.",
      },
    },
    async () => {
      const predictions = [
        "A pleasant surprise is waiting for you.",
        "Your hard work will soon pay off.",
        "An unexpected friendship will brighten your week.",
        "The best is yet to come.",
        "A small step today leads to a giant leap tomorrow.",
        "Trust your instincts: they are sharper than you think.",
        "Adventure awaits just around the corner.",
        "A long-forgotten idea will return with great success.",
        "Kindness given today will be returned threefold.",
        "Something you lost will soon be found.",
      ];
      const prediction =
        predictions[Math.floor(Math.random() * predictions.length)];

      // simulate backend work
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        structuredContent: { prediction },
        content: [{ type: "text", text: prediction }],
        isError: false,
      };
    },
  )
  .registerTool(
    {
      name: "get-chess-player",
      description:
        "Look up a Chess.com player by username and show their profile and game statistics (rapid, blitz, bullet ratings and win/loss records).",
      inputSchema: {
        username: z.string().describe("The Chess.com username to look up."),
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
  );

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

export default await server.run();

export type AppType = typeof server;
