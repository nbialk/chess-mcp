import { Chess } from "chess.js";
import { z } from "zod";

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
  .nullish();

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

const player = (handle: string) =>
  `https://api.chess.com/pub/player/${encodeURIComponent(handle)}`;

export async function fetchProfile(handle: string): Promise<Profile | null> {
  const parsed = profileSchema.safeParse(await fetchJson(player(handle)));
  return parsed.success ? parsed.data : null;
}

export async function fetchStats(handle: string): Promise<Stats | null> {
  const parsed = statsSchema.safeParse(await fetchJson(`${player(handle)}/stats`));
  return parsed.success ? parsed.data : null;
}

export async function fetchArchiveUrls(handle: string): Promise<string[]> {
  const parsed = z
    .object({ archives: z.array(z.string()).optional() })
    .safeParse(await fetchJson(`${player(handle)}/games/archives`));
  return parsed.success ? (parsed.data.archives ?? []) : [];
}

export async function fetchArchiveGames(url: string): Promise<Game[]> {
  const parsed = z
    .object({ games: z.array(gameSchema).optional() })
    .safeParse(await fetchJson(url));
  return parsed.success ? (parsed.data.games ?? []) : [];
}

export function formatMode(mode: Stats["chess_rapid"]):
  | { rating: number | null; best: number | null; win: number; loss: number; draw: number }
  | null {
  return mode
    ? {
        rating: mode.last?.rating ?? null,
        best: mode.best?.rating ?? null,
        win: mode.record?.win ?? 0,
        loss: mode.record?.loss ?? 0,
        draw: mode.record?.draw ?? 0,
      }
    : null;
}

export function pgnTag(pgn: string, name: string): string | null {
  return pgn.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? null;
}

export function extractOpening(ecoUrl: string | null): string | null {
  return ecoUrl
    ? decodeURIComponent(ecoUrl.split("/").pop() ?? "")
        .replace(/-/g, " ")
        .trim() || null
    : null;
}

export function buildReplay(pgn: string): {
  positions: string[];
  moves: string[];
} {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const history = chess.history();
    const replay = new Chess();
    const positions = [replay.fen()];
    const moves: string[] = [];
    for (const san of history) {
      replay.move(san);
      positions.push(replay.fen());
      moves.push(san);
    }
    return { positions, moves };
  } catch {
    return { positions: [], moves: [] };
  }
}

const DRAW_RESULTS = [
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
];

export function mapGameResult(
  result: string | undefined,
): "win" | "draw" | "loss" {
  if (result === "win") return "win";
  if (result && DRAW_RESULTS.includes(result)) return "draw";
  return "loss";
}

export const dailyPuzzleSchema = z.object({
  title: z.string(),
  url: z.string(),
  publish_time: z.number(),
  fen: z.string(),
  pgn: z.string(),
  image: z.string(),
});
export type DailyPuzzle = z.infer<typeof dailyPuzzleSchema>;

export async function fetchDailyPuzzle(): Promise<DailyPuzzle | null> {
  const parsed = dailyPuzzleSchema.safeParse(
    await fetchJson("https://api.chess.com/pub/puzzle"),
  );
  return parsed.success ? parsed.data : null;
}

export type SolutionMove = {
  san: string;
  from: string;
  to: string;
  promotion?: string;
};

// Replay the puzzle PGN from its starting FEN to recover the solution line as
// verbose moves (so the view can auto-play replies and auto-match promotions).
export function buildPuzzleSolution(fen: string, pgn: string): SolutionMove[] {
  try {
    const chess = new Chess(fen);
    chess.loadPgn(pgn);
    return chess.history({ verbose: true }).map((move) => ({
      san: move.san,
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    }));
  } catch {
    return [];
  }
}
