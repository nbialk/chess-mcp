import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";
import bishopWhite from "@/assets/pieces/bishop-white.png";
import bishop from "@/assets/pieces/bishop.png";
import kingWhite from "@/assets/pieces/king-white.png";
import king from "@/assets/pieces/king.png";
import knightWhite from "@/assets/pieces/knight-white.png";
import knight from "@/assets/pieces/knight.png";
import pawnWhite from "@/assets/pieces/pawn-white.png";
import pawn from "@/assets/pieces/pawn.png";
import queenWhite from "@/assets/pieces/queen-white.png";
import queen from "@/assets/pieces/queen.png";
import rookWhite from "@/assets/pieces/rook-white.png";
import rook from "@/assets/pieces/rook.png";
import { fenToRows } from "./lib.js";

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

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export type Move = { from: string; to: string; promotion?: string };

// A board you can click to move on. Click a piece of `selectableColor` to
// select it (legal destinations are dotted), then click a destination to emit
// `onMove`. Display-only mirror of `Board`; promotions default to queen and the
// caller can override when matching a known solution move.
export function InteractiveBoard({
  fen,
  flip = false,
  selectableColor,
  onMove,
  lastMove,
  disabled = false,
}: {
  fen: string;
  flip?: boolean;
  selectableColor: "w" | "b";
  onMove: (move: Move) => void;
  lastMove?: { from: string; to: string } | null;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<Square | null>(null);

  const game = useMemo(() => new Chess(fen), [fen]);

  // Legal destinations for the selected square.
  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(
      game
        .moves({ square: selected, verbose: true })
        .map((move) => move.to as string),
    );
  }, [game, selected]);

  const base = fenToRows(fen);
  const rows = flip ? base.map((row) => [...row].reverse()).reverse() : base;

  const squareName = (r: number, c: number): Square => {
    const rank = flip ? r + 1 : 8 - r;
    const file = flip ? FILES[7 - c] : FILES[c];
    return `${file}${rank}` as Square;
  };

  const handleClick = (square: Square, piece: string) => {
    if (disabled) return;

    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (targets.has(square)) {
        onMove({ from: selected, to: square });
        setSelected(null);
        return;
      }
    }

    // Select only own-color pieces that have legal moves.
    const isOwnPiece =
      piece !== "" &&
      (selectableColor === "w"
        ? piece === piece.toUpperCase()
        : piece === piece.toLowerCase());
    if (isOwnPiece && game.moves({ square, verbose: true }).length > 0) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="mx-auto grid aspect-square w-full max-w-[20rem] grid-cols-8 grid-rows-8 overflow-hidden rounded-md border border-border">
      {rows.map((row, r) =>
        row.map((piece, c) => {
          const dark = (r + c) % 2 === 1;
          const isWhitePiece = piece !== "" && piece === piece.toUpperCase();
          const square = squareName(r, c);
          const rank = flip ? r + 1 : 8 - r;
          const file = flip ? FILES[7 - c] : FILES[c];
          const labelColor = dark ? "text-emerald-50" : "text-emerald-700/80";
          const isSelected = selected === square;
          const isTarget = targets.has(square);
          const isLastMove =
            lastMove?.from === square || lastMove?.to === square;
          return (
            <button
              type="button"
              key={`${r}-${c}`}
              onClick={() => handleClick(square, piece)}
              disabled={disabled}
              aria-label={square}
              className={`relative flex aspect-square items-center justify-center ${
                dark ? "bg-emerald-700/80" : "bg-emerald-50"
              } ${isSelected ? "ring-2 ring-inset ring-amber-400" : ""} ${
                isLastMove ? "after:absolute after:inset-0 after:bg-amber-300/30" : ""
              } ${disabled ? "cursor-default" : "cursor-pointer"}`}
            >
              {c === 0 && (
                <span
                  className={`absolute left-[6%] top-[4%] text-[0.6rem] font-semibold leading-none ${labelColor}`}
                >
                  {rank}
                </span>
              )}
              {r === 7 && (
                <span
                  className={`absolute bottom-[4%] right-[6%] text-[0.6rem] font-semibold leading-none ${labelColor}`}
                >
                  {file}
                </span>
              )}
              {piece && (
                <img
                  src={
                    PIECE_IMAGES[piece.toLowerCase()][
                      isWhitePiece ? "white" : "black"
                    ]
                  }
                  alt={`${isWhitePiece ? "white" : "black"} ${PIECE_NAMES[piece.toLowerCase()]}`}
                  className="relative z-10 h-[78%] w-[78%] select-none object-contain"
                  draggable={false}
                />
              )}
              {isTarget && (
                <span
                  aria-hidden
                  className={`absolute z-20 rounded-full ${
                    piece
                      ? "inset-[8%] border-4 border-amber-400/70"
                      : "size-[28%] bg-amber-400/70"
                  }`}
                />
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
