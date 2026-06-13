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

export function Board({ fen, flip = false }: { fen: string; flip?: boolean }) {
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
          const rank = flip ? r + 1 : 8 - r;
          const file = flip ? FILES[7 - c] : FILES[c];
          const labelColor = dark ? "text-emerald-50" : "text-emerald-700/80";
          return (
            <div
              key={`${r}-${c}`}
              className={`relative flex aspect-square items-center justify-center ${
                dark ? "bg-emerald-700/80" : "bg-emerald-50"
              }`}
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
