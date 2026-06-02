import { Trophy } from "lucide-react";

export function PlayerBar({
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
