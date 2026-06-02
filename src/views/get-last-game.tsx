import "@/index.css";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Rabbit,
  SearchX,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { useLayout, useOpenExternal } from "skybridge/web";
import { useToolInfo } from "../helpers.js";
import bishop from "@/assets/pieces/bishop.png";
import king from "@/assets/pieces/king.png";
import knight from "@/assets/pieces/knight.png";
import pawn from "@/assets/pieces/pawn.png";
import queen from "@/assets/pieces/queen.png";
import rook from "@/assets/pieces/rook.png";
import bishopWhite from "@/assets/pieces/bishop-white.png";
import kingWhite from "@/assets/pieces/king-white.png";
import knightWhite from "@/assets/pieces/knight-white.png";
import pawnWhite from "@/assets/pieces/pawn-white.png";
import queenWhite from "@/assets/pieces/queen-white.png";
import rookWhite from "@/assets/pieces/rook-white.png";

const TIME_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  blitz: Zap,
  rapid: Timer,
  bullet: Rabbit,
  daily: CalendarClock,
};

const RESULT_STYLES = {
  win: { label: "Win", className: "bg-emerald-600 text-white" },
  draw: { label: "Draw", className: "bg-muted-foreground/30 text-foreground" },
  loss: { label: "Loss", className: "bg-rose-600 text-white" },
} as const;

const PIECE_IMAGES: Record<string, { white: string; black: string }> = {
  k: { white: kingWhite, black: king },
  q: { white: queenWhite, black: queen },
  r: { white: rookWhite, black: rook },
  b: { white: bishopWhite, black: bishop },
  n: { white: knightWhite, black: knight },
  p: { white: pawnWhite, black: pawn },
};

const PIECE_NAMES: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

function fenToRows(fen: string): string[][] {
  const placement = fen.split(" ")[0];
  return placement.split("/").map((row) => {
    const squares: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) squares.push("");
      } else {
        squares.push(ch);
      }
    }
    return squares;
  });
}

function Board({ fen, flip = false }: { fen: string; flip?: boolean }) {
  const base = fenToRows(fen);
  const rows = flip
    ? base.map((row) => [...row].reverse()).reverse()
    : base;
  return (
    <div className="mx-auto grid aspect-square w-full max-w-[20rem] grid-cols-8 grid-rows-8 overflow-hidden rounded-md border border-border">
      {rows.map((row, r) =>
        row.map((piece, c) => {
          const dark = (r + c) % 2 === 1;
          const isWhitePiece = piece !== "" && piece === piece.toUpperCase();
          return (
            <div
              key={`${r}-${c}`}
              className={`flex aspect-square items-center justify-center ${
                dark ? "bg-emerald-700/80" : "bg-emerald-50"
              }`}
            >
              {piece && (
                <img
                  src={
                    PIECE_IMAGES[piece.toLowerCase()][
                      isWhitePiece ? "white" : "black"
                    ]
                  }
                  alt={`${isWhitePiece ? "white" : "black"} ${PIECE_NAMES[piece.toLowerCase()]}`}
                  className="h-[78%] w-[78%] select-none object-contain"
                  draggable={false}
                />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

function PlayerBar({
  name,
  rating,
  color,
  isWinner,
}: {
  name: string;
  rating: number | null;
  color: "white" | "black";
  isWinner: boolean;
}) {
  return (
    <div className="flex items-center gap-2 type-text-sm">
      <span
        aria-hidden
        className={`size-4 shrink-0 rounded-full border ${
          color === "white"
            ? "border-zinc-300 bg-white"
            : "border-zinc-600 bg-zinc-900"
        }`}
      />
      <span className="font-medium">@{name}</span>
      {rating != null && (
        <span className="text-muted-foreground">({rating})</span>
      )}
      {isWinner && (
        <Trophy className="size-3.5 shrink-0 text-amber-500" aria-label="Winner" />
      )}
    </div>
  );
}

function timeAgo(unixSeconds: number) {
  const diff = Date.now() / 1000 - unixSeconds;
  const day = 86400;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < day) return `${Math.round(diff / 3600)}h ago`;
  if (diff < day * 30) return `${Math.round(diff / day)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

export default function GetLastGame() {
  const { theme } = useLayout();
  const { input, output, isPending } = useToolInfo<"get-last-game">();
  const openExternal = useOpenExternal();

  const game = output?.found ? output.game : undefined;
  const positions = game?.positions ?? [];
  const [ply, setPly] = useState<number | null>(null);
  // null = follow the latest position (final move).
  const maxPly = Math.max(0, positions.length - 1);
  const current = ply ?? maxPly;
  const goto = (next: number) =>
    setPly(Math.min(maxPly, Math.max(0, next)));

  const wrap = (children: React.ReactNode) => (
    <div
      className={`${theme === "dark" ? "dark" : ""} mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-background text-foreground`}
    >
      {children}
    </div>
  );

  if (isPending) {
    return wrap(
      <div className="flex flex-col gap-3 p-5">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>,
    );
  }

  if (!output?.found || !output.game) {
    return wrap(
      <div className="flex items-center gap-3 p-5 type-text-sm text-muted-foreground">
        <SearchX className="size-5 shrink-0" />
        <span>
          No recent game found for{" "}
          <span className="font-medium text-foreground">
            “{input?.username}”
          </span>
          .
        </span>
      </div>,
    );
  }

  const g = output.game;
  const result = RESULT_STYLES[g.result];
  const TimeIcon = g.timeClass ? TIME_ICONS[g.timeClass] : undefined;
  const timeLabel = g.timeClass
    ? g.timeClass[0].toUpperCase() + g.timeClass.slice(1)
    : null;

  const userColor = g.color as "white" | "black";
  const opponentColor = userColor === "white" ? "black" : "white";
  // Flip the board so the searched player is always at the bottom.
  const flip = userColor === "black";
  const userWon = g.result === "win";
  const opponentWon = g.result === "loss";

  return wrap(
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-5">
        <span
          className={`shrink-0 rounded-md px-2.5 py-1 type-text-sm font-bold uppercase tracking-wide ${result.className}`}
        >
          {result.label}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 type-text-xs text-muted-foreground">
          {timeLabel && (
            <span className="flex items-center gap-1">
              {TimeIcon && <TimeIcon className="size-3.5" />}
              {timeLabel}
            </span>
          )}
          {g.rated != null && <span>{g.rated ? "Rated" : "Casual"}</span>}
          <span className="capitalize">{g.color}</span>
        </div>
      </div>

      {/* Board + player bars + move navigation */}
      {positions.length > 1 && (
        <div className="flex flex-col gap-3 p-5">
          {/* Opponent (top) */}
          <PlayerBar
            name={g.opponent ?? "opponent"}
            rating={g.opponentRating}
            color={opponentColor}
            isWinner={opponentWon}
          />
          <Board fen={positions[current]} flip={flip} />
          {/* Searched player (bottom) */}
          <PlayerBar
            name={output.username}
            rating={g.userRating}
            color={userColor}
            isWinner={userWon}
          />
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => goto(0)}
              disabled={current === 0}
              aria-label="First move"
              className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => goto(current - 1)}
              disabled={current === 0}
              aria-label="Previous move"
              className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-24 text-center type-text-xs tabular-nums text-muted-foreground">
              {current === 0
                ? "Start"
                : `${Math.ceil(current / 2)}${current % 2 === 1 ? "." : "..."} ${g.moves[current - 1] ?? ""}`}
            </span>
            <button
              type="button"
              onClick={() => goto(current + 1)}
              disabled={current === maxPly}
              aria-label="Next move"
              className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => goto(maxPly)}
              disabled={current === maxPly}
              aria-label="Last move"
              className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Player matchup fallback when no board is available */}
      {positions.length <= 1 && (
        <div className="flex flex-col gap-2 p-5">
          <PlayerBar
            name={output.username}
            rating={g.userRating}
            color={userColor}
            isWinner={userWon}
          />
          <PlayerBar
            name={g.opponent ?? "opponent"}
            rating={g.opponentRating}
            color={opponentColor}
            isWinner={opponentWon}
          />
        </div>
      )}

      {/* Opening + termination */}
      {(g.opening || g.termination) && (
        <div className="flex flex-col gap-1 px-5 pb-5 type-text-xs text-muted-foreground">
          {g.opening && (
            <span className="font-medium text-foreground">{g.opening}</span>
          )}
          {g.termination && <span>{g.termination}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <span className="type-text-xs text-muted-foreground">
          {g.endTime != null ? timeAgo(g.endTime) : ""}
        </span>
        {g.url && (
          <button
            type="button"
            onClick={() => openExternal(g.url)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 type-text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            View game
            <ExternalLink className="size-3.5" />
          </button>
        )}
      </div>
    </div>,
  );
}
