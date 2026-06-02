import "@/index.css";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Pause,
  Play,
  SearchX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLayout, useOpenExternal } from "skybridge/web";
import { useToolInfo } from "../../helpers.js";
import { Board } from "./board.js";
import { RESULT_STYLES, TIME_ICONS, timeAgo } from "./lib.js";
import { MovesPanel } from "./moves-panel.js";
import { PlayerBar } from "./player-bar.js";

export default function GetLastGame() {
  const { theme } = useLayout();
  const { input, output, isPending } = useToolInfo<"get-last-game">();
  const openExternal = useOpenExternal();

  const game = output?.found ? output.game : undefined;
  const positions = game?.positions ?? [];
  const [ply, setPly] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // null = follow the latest position (final move).
  const maxPly = Math.max(0, positions.length - 1);
  const current = ply ?? maxPly;
  const goto = (next: number) =>
    setPly(Math.min(maxPly, Math.max(0, next)));

  useEffect(() => {
    if (!isPlaying) return;
    if (current >= maxPly) {
      setIsPlaying(false);
      return;
    }
    const id = setTimeout(() => setPly(current + 1), 900);
    return () => clearTimeout(id);
  }, [isPlaying, current, maxPly]);

  const togglePlay = () => {
    if (!isPlaying && current >= maxPly) setPly(0);
    setIsPlaying((p) => !p);
  };

  const wrap = (children: React.ReactNode) => (
    <div
      className={`${theme === "dark" ? "dark" : ""} mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background text-foreground`}
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
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-stretch">
          {/* Left: board with player bars */}
          <div className="flex flex-col gap-3 sm:flex-1">
            <PlayerBar
              name={g.opponent ?? "opponent"}
              rating={g.opponentRating}
              color={opponentColor}
              isWinner={opponentWon}
            />
            <Board fen={positions[current]} flip={flip} />
            <PlayerBar
              name={output.username}
              rating={g.userRating}
              color={userColor}
              isWinner={userWon}
            />
          </div>

          {/* Right: moves panel + navigation (Chess.com-style).
              `sm:relative` + absolute inner wrapper keeps the moves list from
              inflating the column: the board column alone drives the row
              height, and the panel fills it via stretch. No JS measurement. */}
          <div className="sm:relative sm:w-56">
            <div className="flex min-h-0 flex-col gap-2 sm:absolute sm:inset-0">
              <MovesPanel
                opening={g.opening}
                termination={g.termination}
                moves={g.moves}
                current={current}
                onSelect={(p) => {
                  setIsPlaying(false);
                  goto(p);
                }}
              />
              <div className="flex shrink-0 items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  goto(0);
                }}
                disabled={current === 0}
                aria-label="First move"
                className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  goto(current - 1);
                }}
                disabled={current === 0}
                aria-label="Previous move"
                className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex size-9 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
              >
                {isPlaying ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  goto(current + 1);
                }}
                disabled={current === maxPly}
                aria-label="Next move"
                className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  goto(maxPly);
                }}
                disabled={current === maxPly}
                aria-label="Last move"
                className="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
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

      {/* Opening + termination (only in the no-board fallback) */}
      {positions.length <= 1 && (g.opening || g.termination) && (
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
