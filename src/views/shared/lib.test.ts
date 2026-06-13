import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fenToRows, timeAgo, toMoveRows } from "./lib.js";

describe("fenToRows", () => {
  it("parses the start position into 8 rows of 8 squares", () => {
    const rows = fenToRows(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.length === 8)).toBe(true);
    expect(rows[0]).toEqual(["r", "n", "b", "q", "k", "b", "n", "r"]);
    for (const r of [2, 3, 4, 5]) {
      expect(rows[r]).toEqual(["", "", "", "", "", "", "", ""]);
    }
  });

  it("expands a digit in the middle of a row into empty squares", () => {
    const rows = fenToRows(
      "r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 2 2",
    );
    expect(rows[0]).toEqual(["r", "", "b", "q", "k", "b", "n", "r"]);
  });

  it("reads only the placement field, never trailing FEN fields", () => {
    const rows = fenToRows(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    const flat = rows.flat();
    expect(flat).not.toContain("w");
    expect(flat).not.toContain("-");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const now = () => Date.now() / 1000;

  it("floors sub-minute durations to 1m", () => {
    expect(timeAgo(now() - 30)).toBe("1m ago");
  });

  it("renders minutes", () => {
    expect(timeAgo(now() - 5 * 60)).toBe("5m ago");
  });

  it("renders hours", () => {
    expect(timeAgo(now() - 2 * 3600)).toBe("2h ago");
  });

  it("renders days", () => {
    expect(timeAgo(now() - 3 * 86400)).toBe("3d ago");
  });

  it("falls back to a locale date beyond 30 days", () => {
    const unix = now() - 60 * 86400;
    expect(timeAgo(unix)).toBe(new Date(unix * 1000).toLocaleDateString());
  });
});

describe("toMoveRows", () => {
  it("returns an empty array for no moves", () => {
    expect(toMoveRows([])).toEqual([]);
  });

  it("pairs a lone white move with an undefined black move", () => {
    expect(toMoveRows(["e4"])).toEqual([
      { number: 1, white: "e4", black: undefined },
    ]);
  });

  it("groups moves into numbered rows", () => {
    const rows = toMoveRows(["e4", "e5", "Nf3"]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ number: 2, white: "Nf3", black: undefined });
  });
});
