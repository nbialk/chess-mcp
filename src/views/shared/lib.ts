import {
  CalendarClock,
  type LucideIcon,
  Rabbit,
  Timer,
  Zap,
} from "lucide-react";

export const TIME_ICONS: Record<string, LucideIcon> = {
  blitz: Zap,
  rapid: Timer,
  bullet: Rabbit,
  daily: CalendarClock,
};

export const RESULT_STYLES = {
  win: { label: "Win", className: "bg-emerald-600 text-white" },
  draw: { label: "Draw", className: "bg-muted-foreground/30 text-foreground" },
  loss: { label: "Loss", className: "bg-rose-600 text-white" },
} as const;

export type MoveRow = { number: number; white?: string; black?: string };

export function toMoveRows(moves: string[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }
  return rows;
}

export function fenToRows(fen: string): string[][] {
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

export function timeAgo(unixSeconds: number) {
  const diff = Date.now() / 1000 - unixSeconds;
  const day = 86400;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < day) return `${Math.round(diff / 3600)}h ago`;
  if (diff < day * 30) return `${Math.round(diff / day)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}
