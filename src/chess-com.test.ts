import { describe, expect, it } from "vitest";
import {
  buildReplay,
  extractOpening,
  formatMode,
  mapGameResult,
  pgnTag,
  profileSchema,
} from "./chess-com.js";

describe("mapGameResult", () => {
  it("maps a win", () => {
    expect(mapGameResult("win")).toBe("win");
  });

  it("maps every draw code to draw", () => {
    for (const code of [
      "agreed",
      "repetition",
      "stalemate",
      "insufficient",
      "50move",
      "timevsinsufficient",
    ]) {
      expect(mapGameResult(code)).toBe("draw");
    }
  });

  it("maps loss codes and undefined to loss", () => {
    expect(mapGameResult("checkmated")).toBe("loss");
    expect(mapGameResult("timeout")).toBe("loss");
    expect(mapGameResult("resigned")).toBe("loss");
    expect(mapGameResult(undefined)).toBe("loss");
  });
});

describe("pgnTag", () => {
  const pgn = '[ECOUrl "https://x/y"]\n[Termination "Foo won"]\n\n1. e4 *';

  it("extracts a named tag", () => {
    expect(pgnTag(pgn, "ECOUrl")).toBe("https://x/y");
    expect(pgnTag(pgn, "Termination")).toBe("Foo won");
  });

  it("returns null when the tag is absent", () => {
    expect(pgnTag(pgn, "WhiteElo")).toBeNull();
  });
});

describe("extractOpening", () => {
  it("turns the ECO url slug into a readable opening", () => {
    expect(
      extractOpening("https://www.chess.com/openings/Sicilian-Defense-Open"),
    ).toBe("Sicilian Defense Open");
  });

  it("decodes URL-encoded segments", () => {
    expect(extractOpening("https://x/Queen%27s-Gambit")).toBe("Queen's Gambit");
  });

  it("returns null for null input", () => {
    expect(extractOpening(null)).toBeNull();
  });

  it("returns null when the url ends in a slash (empty segment)", () => {
    expect(extractOpening("https://x/openings/")).toBeNull();
  });
});

describe("buildReplay", () => {
  it("builds positions and moves from a valid PGN", () => {
    const { positions, moves } = buildReplay("1. e4 e5 2. Nf3 *");
    expect(moves).toEqual(["e4", "e5", "Nf3"]);
    expect(positions).toHaveLength(4);
    expect(positions[0]).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("never throws on garbage input", () => {
    expect(() => buildReplay("not a pgn")).not.toThrow();
    const { moves } = buildReplay("not a pgn");
    expect(Array.isArray(moves)).toBe(true);
  });
});

describe("formatMode", () => {
  it("returns null for undefined", () => {
    expect(formatMode(undefined)).toBeNull();
  });

  it("maps a full mode object", () => {
    expect(
      formatMode({
        last: { rating: 2800 },
        best: { rating: 2900 },
        record: { win: 10, loss: 2, draw: 3 },
      }),
    ).toEqual({ rating: 2800, best: 2900, win: 10, loss: 2, draw: 3 });
  });

  it("defaults missing record fields to zero and ratings to null", () => {
    expect(formatMode({})).toEqual({
      rating: null,
      best: null,
      win: 0,
      loss: 0,
      draw: 0,
    });
  });
});

describe("profileSchema leniency", () => {
  it("accepts extra unknown keys and missing optional keys", () => {
    const parsed = profileSchema.safeParse({
      username: "magnuscarlsen",
      surprise: "field",
    });
    expect(parsed.success).toBe(true);
  });

  it("fails when the required username is missing", () => {
    expect(profileSchema.safeParse({ name: "no handle" }).success).toBe(false);
  });
});
