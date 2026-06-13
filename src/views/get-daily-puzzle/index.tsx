import "@/index.css";

import { Chess } from "chess.js";
import {
  CircleCheckBig,
  ExternalLink,
  Eye,
  PartyPopper,
  RotateCcw,
  SearchX,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLayout, useOpenExternal } from "skybridge/web";
import { useToolInfo } from "../../helpers.js";
import {
  InteractiveBoard,
  type Move,
} from "../shared/interactive-board.js";

type Status = "solving" | "wrong" | "solved" | "revealed";

export default function GetDailyPuzzle() {
  const { theme } = useLayout();
  const { output, isPending } = useToolInfo<"get-daily-puzzle">();
  const openExternal = useOpenExternal();

  const puzzle = output?.found ? output.puzzle : undefined;
  const solution = puzzle?.solution ?? [];

  // A chess.js instance we mutate as moves are played. Rebuilt when the puzzle
  // changes.
  const game = useMemo(
    () => (puzzle ? new Chess(puzzle.fen) : new Chess()),
    [puzzle],
  );

  const [fen, setFen] = useState(puzzle?.fen ?? "");
  const [solvedCount, setSolvedCount] = useState(0);
  const [status, setStatus] = useState<Status>("solving");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset solver state when the puzzle changes.
  useEffect(() => {
    setFen(puzzle?.fen ?? "");
    setSolvedCount(0);
    setStatus("solving");
    setLastMove(null);
  }, [puzzle]);

  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  const wrap = (children: React.ReactNode) => (
    <div
      className={`${theme === "dark" ? "dark" : ""} w-full overflow-hidden bg-background text-foreground`}
    >
      {children}
    </div>
  );

  if (isPending) {
    return wrap(
      <div className="flex flex-col gap-3 p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mx-auto aspect-square w-full max-w-[20rem] animate-pulse rounded-md bg-muted" />
      </div>,
    );
  }

  if (!puzzle) {
    return wrap(
      <div className="flex items-center gap-3 p-5 type-text-sm text-muted-foreground">
        <SearchX className="size-5 shrink-0" />
        <span>Could not load the daily puzzle. Try again later.</span>
      </div>,
    );
  }

  const sideToMove: "w" | "b" = puzzle.sideToMove === "b" ? "b" : "w";
  const flip = sideToMove === "b";
  const done = status === "solved" || status === "revealed";

  const applyMove = (move: { from: string; to: string; promotion?: string }) => {
    game.move(move);
    setFen(game.fen());
    setLastMove({ from: move.from, to: move.to });
  };

  const reset = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    game.load(puzzle.fen);
    setFen(puzzle.fen);
    setSolvedCount(0);
    setStatus("solving");
    setLastMove(null);
  };

  const handleMove = ({ from, to }: Move) => {
    if (done) return;

    const expected = solution[solvedCount];
    if (!expected) return;

    // Validate legality against a throwaway copy so a wrong attempt never
    // mutates the live game. chess.js throws on an illegal move.
    const probe = new Chess(game.fen());
    let san: string;
    try {
      san = probe.move({ from, to, promotion: expected.promotion ?? "q" }).san;
    } catch {
      setStatus("wrong");
      return;
    }

    if (san !== expected.san) {
      setStatus("wrong");
      return;
    }

    // Correct: play it on the live game.
    applyMove({ from, to, promotion: expected.promotion });
    const nextCount = solvedCount + 1;

    // Auto-play the opponent's scripted reply, if any.
    const reply = solution[nextCount];
    if (reply) {
      setStatus("solving");
      revealTimer.current = setTimeout(() => {
        applyMove(reply);
        const afterReply = nextCount + 1;
        setSolvedCount(afterReply);
        setStatus(afterReply >= solution.length ? "solved" : "solving");
      }, 500);
    } else {
      setSolvedCount(nextCount);
      setStatus("solved");
    }
  };

  const revealSolution = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setStatus("revealed");
    const replay = new Chess(game.fen());
    let i = solvedCount;
    const step = () => {
      const move = solution[i];
      if (!move) return;
      replay.move(move);
      setFen(replay.fen());
      setLastMove({ from: move.from, to: move.to });
      i += 1;
      revealTimer.current = setTimeout(step, 700);
    };
    step();
  };

  const sideLabel = puzzle.sideToMove === "w" ? "White" : "Black";

  return wrap(
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-5">
        <span className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 type-text-sm font-bold uppercase tracking-wide text-white">
          Puzzle
        </span>
        <span className="truncate text-base font-semibold">{puzzle.title}</span>
      </div>

      {/* Board + status */}
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 type-text-sm">
          <span
            aria-hidden
            className={`size-4 shrink-0 rounded-full border ${
              puzzle.sideToMove === "w"
                ? "border-zinc-300 bg-white"
                : "border-zinc-600 bg-zinc-900"
            }`}
          />
          <span className="font-medium">{sideLabel} to move</span>
        </div>

        <InteractiveBoard
          fen={fen || puzzle.fen}
          flip={flip}
          selectableColor={sideToMove}
          onMove={handleMove}
          lastMove={lastMove}
          disabled={done}
        />

        {/* Feedback line */}
        <div className="min-h-6 type-text-sm" aria-live="polite">
          {status === "wrong" && (
            <span className="flex animate-in fade-in items-center gap-1.5 font-medium text-rose-600">
              <XCircle className="size-4" />
              Not the solution — try again.
            </span>
          )}
          {status === "solving" && solvedCount > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CircleCheckBig className="size-4" />
              Correct — keep going.
            </span>
          )}
          {status === "solved" && (
            <span className="flex animate-in fade-in zoom-in items-center gap-1.5 font-semibold text-emerald-600">
              <PartyPopper className="size-4" />
              Solved! Well played.
            </span>
          )}
          {status === "revealed" && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-4" />
              Showing the solution.
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        {!done ? (
          <button
            type="button"
            onClick={revealSolution}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 type-text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Eye className="size-3.5" />
            Show solution
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 type-text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={() => openExternal(puzzle.url)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 type-text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Chess.com
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>,
  );
}
