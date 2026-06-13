import { useEffect, useRef } from "react";
import { toMoveRows } from "./lib.js";

export function MovesPanel({
  opening,
  termination,
  moves,
  current,
  onSelect,
}: {
  opening: string | null;
  termination: string | null;
  moves: string[];
  current: number;
  onSelect: (ply: number) => void;
}) {
  const rows = toMoveRows(moves);
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToActive = () => {
      activeRef.current?.scrollIntoView({ block: "nearest" });
    };
    // Run after layout settles (panel height is set async via ResizeObserver).
    const raf = requestAnimationFrame(scrollToActive);
    const list = listRef.current;
    const ro = list ? new ResizeObserver(scrollToActive) : null;
    if (list && ro) ro.observe(list);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [current, moves]);

  const cell = (ply: number, san?: string) => {
    if (!san) return <span className="flex-1" />;
    const isActive = current === ply;
    return (
      <button
        type="button"
        ref={isActive ? activeRef : undefined}
        onClick={() => onSelect(ply)}
        className={`flex-1 rounded px-1.5 py-0.5 text-left tabular-nums transition-colors hover:bg-muted ${
          isActive ? "bg-muted font-semibold text-foreground" : ""
        }`}
      >
        {san}
      </button>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-border sm:w-56">
      {opening && (
        <div className="shrink-0 border-b border-border px-3 py-2 type-text-sm font-medium text-foreground">
          {opening}
        </div>
      )}
      <div
        ref={listRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-1 py-1 type-text-xs text-muted-foreground"
      >
        {rows.map((row) => {
          const whitePly = (row.number - 1) * 2 + 1;
          const blackPly = whitePly + 1;
          return (
            <div
              key={row.number}
              className="flex items-center gap-1 rounded px-1 py-0.5 odd:bg-muted/30"
            >
              <span className="w-6 shrink-0 text-right text-muted-foreground/70">
                {row.number}.
              </span>
              {cell(whitePly, row.white)}
              {cell(blackPly, row.black)}
            </div>
          );
        })}
      </div>
      {termination && (
        <div className="shrink-0 border-t border-border px-3 py-2 type-text-xs text-muted-foreground">
          {termination}
        </div>
      )}
    </div>
  );
}
