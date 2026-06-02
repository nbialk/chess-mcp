import "@/index.css";

import {
  ChevronsUp,
  ExternalLink,
  MapPin,
  Rabbit,
  SearchX,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import { useLayout, useOpenExternal } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

type ModeStats = {
  rating: number | null;
  best: number | null;
  win: number;
  loss: number;
  draw: number;
};

type Mode = {
  key: "blitz" | "rapid" | "bullet";
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const MODES: Mode[] = [
  { key: "blitz", label: "Blitz", Icon: Zap },
  { key: "rapid", label: "Rapid", Icon: Timer },
  { key: "bullet", label: "Bullet", Icon: Rabbit },
];

function ModeCard({ mode, stats }: { mode: Mode; stats: ModeStats }) {
  const { Icon } = mode;
  const total = stats.win + stats.loss + stats.draw;
  const winRate = total > 0 ? Math.round((stats.win / total) * 100) : 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="type-text-xs font-medium uppercase tracking-wide">
            {mode.label}
          </span>
        </div>
        {stats.best != null && (
          <span
            className="flex items-center gap-0.5 type-text-xs text-muted-foreground tabular-nums"
            title="Peak rating"
          >
            <ChevronsUp className="size-3" />
            {stats.best}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">
          {stats.rating ?? "–"}
        </span>
        <span className="type-text-xs text-muted-foreground">rating</span>
      </div>

      <div
        className="flex h-1 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${stats.win} wins, ${stats.draw} draws, ${stats.loss} losses`}
      >
        <div
          className="h-full bg-emerald-600"
          style={{ width: `${pct(stats.win)}%` }}
        />
        <div
          className="h-full bg-muted-foreground/40"
          style={{ width: `${pct(stats.draw)}%` }}
        />
        <div
          className="h-full bg-rose-600"
          style={{ width: `${pct(stats.loss)}%` }}
        />
      </div>

      <div className="flex items-center justify-between type-text-xs tabular-nums text-muted-foreground">
        <span>
          {stats.win}W&ensp;{stats.draw}D&ensp;{stats.loss}L
        </span>
        <span className="font-medium text-foreground">{winRate}% won</span>
      </div>
    </div>
  );
}

export default function GetChessPlayer() {
  const { theme } = useLayout();
  const { input, output, isPending, responseMetadata } =
    useToolInfo<"get-chess-player">();
  const openExternal = useOpenExternal();

  const wrap = (children: React.ReactNode) => (
    <div
      className={`${theme === "dark" ? "dark" : ""} w-full overflow-hidden bg-background text-foreground`}
    >
      {children}
    </div>
  );

  if (isPending) {
    return wrap(
      <div className="flex items-center gap-3 p-5">
        <div className="size-12 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>,
    );
  }

  if (!output?.found || !output.player) {
    return wrap(
      <div className="flex items-center gap-3 p-5 type-text-sm text-muted-foreground">
        <SearchX className="size-5 shrink-0" />
        <span>
          No Chess.com player found for{" "}
          <span className="font-medium text-foreground">
            “{input?.username}”
          </span>
          .
        </span>
      </div>,
    );
  }

  const p = output.player;
  const avatar = responseMetadata?.avatar;
  const place = p.location ?? p.country;

  return wrap(
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-5">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold uppercase text-muted-foreground">
            {p.username.slice(0, 2)}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {p.title && (
              <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 type-text-xs font-bold text-white">
                {p.title}
              </span>
            )}
            <span className="truncate text-base font-semibold">
              {p.name ?? p.username}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 type-text-xs text-muted-foreground">
            <span>@{p.username}</span>
            {place && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {place}
              </span>
            )}
            {p.followers > 0 && (
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {p.followers.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        {MODES.map((mode) => {
          const stats = p[mode.key];
          return stats ? (
            <ModeCard key={mode.key} mode={mode} stats={stats} />
          ) : (
            <div
              key={mode.key}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-4 type-text-xs text-muted-foreground"
            >
              <mode.Icon className="size-4 opacity-50" />
              No {mode.label}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 type-text-xs text-muted-foreground tabular-nums">
          {p.fide != null && (
            <span>
              FIDE <span className="font-medium text-foreground">{p.fide}</span>
            </span>
          )}
          {p.league && (
            <span>
              League{" "}
              <span className="font-medium text-foreground">{p.league}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => openExternal(p.url)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 type-text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Chess.com
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>,
  );
}
