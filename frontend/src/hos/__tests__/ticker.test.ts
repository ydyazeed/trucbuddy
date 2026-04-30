import { describe, expect, it } from "vitest";

import { deriveLiveClocks, liveUpcoming } from "../ticker";
import { RULES } from "../rules";
import type { HOSClocks } from "../types";

const FULL: HOSClocks = {
  drive11: RULES.DRIVE_LIMIT_MIN,
  window14: RULES.WINDOW_LIMIT_MIN,
  sinceBreak8: RULES.BREAK_AFTER_DRIVE_MIN,
  cycle70: RULES.CYCLE_LIMIT_MIN,
};

const since = new Date("2026-04-28T12:00:00Z").getTime();

describe("deriveLiveClocks", () => {
  it("returns base when no statusSince is set", () => {
    const out = deriveLiveClocks({ base: FULL, currentStatus: "off_duty", statusSince: null, now: since + 60000 });
    expect(out).toEqual(FULL);
  });

  it("decrements drive/window/break/cycle while driving", () => {
    const out = deriveLiveClocks({
      base: FULL,
      currentStatus: "driving",
      statusSince: new Date(since).toISOString(),
      now: since + 30 * 60_000,
    });
    expect(out.drive11).toBeCloseTo(FULL.drive11 - 30, 5);
    expect(out.window14).toBeCloseTo(FULL.window14 - 30, 5);
    expect(out.sinceBreak8).toBeCloseTo(FULL.sinceBreak8 - 30, 5);
    expect(out.cycle70).toBeCloseTo(FULL.cycle70 - 30, 5);
  });

  it("only decrements window14 + cycle70 while on-duty (and resets break after 30m)", () => {
    const out = deriveLiveClocks({
      base: { ...FULL, sinceBreak8: 100 },
      currentStatus: "on_duty",
      statusSince: new Date(since).toISOString(),
      now: since + 30 * 60_000,
    });
    expect(out.drive11).toBe(FULL.drive11);
    expect(out.window14).toBeCloseTo(FULL.window14 - 30, 5);
    expect(out.sinceBreak8).toBe(RULES.BREAK_AFTER_DRIVE_MIN);
  });

  it("freezes everything during off-duty", () => {
    const out = deriveLiveClocks({
      base: { ...FULL, drive11: 200, window14: 300, sinceBreak8: 100 },
      currentStatus: "off_duty",
      statusSince: new Date(since).toISOString(),
      now: since + 5 * 60_000,
    });
    expect(out.drive11).toBe(200);
    expect(out.window14).toBe(300);
    expect(out.sinceBreak8).toBe(100);
  });

  it("resets sinceBreak8 after 30m off-duty", () => {
    const out = deriveLiveClocks({
      base: { ...FULL, sinceBreak8: 50 },
      currentStatus: "off_duty",
      statusSince: new Date(since).toISOString(),
      now: since + 35 * 60_000,
    });
    expect(out.sinceBreak8).toBe(RULES.BREAK_AFTER_DRIVE_MIN);
  });

  it("resets drive11 + window14 + sinceBreak8 after 10h off-duty", () => {
    const out = deriveLiveClocks({
      base: { ...FULL, drive11: 0, window14: 0, sinceBreak8: 0 },
      currentStatus: "off_duty",
      statusSince: new Date(since).toISOString(),
      now: since + 10 * 60 * 60_000,
    });
    expect(out.drive11).toBe(RULES.DRIVE_LIMIT_MIN);
    expect(out.window14).toBe(RULES.WINDOW_LIMIT_MIN);
    expect(out.sinceBreak8).toBe(RULES.BREAK_AFTER_DRIVE_MIN);
  });
});

describe("liveUpcoming", () => {
  it("picks the most-imminent clock", () => {
    const up = liveUpcoming({ drive11: 200, window14: 100, sinceBreak8: 30, cycle70: 1000 });
    expect(up?.reason).toBe("30-min break");
    expect(up?.minutesUntil).toBe(30);
  });
});
