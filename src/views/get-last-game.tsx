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
  Swords,
  Timer,
  Zap,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { useLayout, useOpenExternal } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

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

const PIECES: Record<string, string> = {
  K: "\u2654",
  Q: "\u2655",
  R: "\u2656",
  B: "\u2657",
  N: "\u2658",
  P: "\u2659",
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
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

function Board({ fen }: { fen: string }) {
  const rows = fenToRows(fen);
  return (
    <div className="mx-auto grid aspect-square w-full max-w-[20rem] grid-cols-8 overflow-hidden rounded-md border border-border">
      {rows.map((row, r) =>
        row.map((piece, c) => {
          const dark = (r + c) % 2 === 1;
          const isWhitePiece = piece !== "" && piece === piece.toUpperCase();
          return (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center ${
                dark ? "bg-emerald-700/80" : "bg-emerald-50"
              }`}
            >
              {piece && (
                <span
                  className={`text-[clamp(1rem,5vw,1.75rem)] leading-none ${
                    isWhitePiece
                      ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]"
                      : "text-zinc-900"
                  }`}
                >
                  {PIECES[piece]}
                </span>
              )}
            </div>
          );
        }),
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

      {/* Matchup */}
      <div className="flex items-center gap-2 p-5 type-text-sm">
        <Swords className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">
          @{output.username}
          {g.userRating != null && (
            <span className="text-muted-foreground"> ({g.userRating})</span>
          )}
        </span>
        <span className="text-muted-foreground">vs</span>
        <span className="font-medium">
          @{g.opponent}
          {g.opponentRating != null && (
            <span className="text-muted-foreground"> ({g.opponentRating})</span>
          )}
        </span>
      </div>

      {/* Board + move navigation */}
      {positions.length > 1 && (
        <div className="flex flex-col gap-3 px-5 pb-5">
          <Board fen={positions[current]} />
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
