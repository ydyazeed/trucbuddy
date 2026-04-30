import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { validateDailyLog } from "../logs";
import type { GeoPoint } from "../types";

const A: GeoPoint = { lat: 41.88, lng: -87.63, label: "Chicago, IL" };
const B: GeoPoint = { lat: 38.63, lng: -90.20, label: "St. Louis, MO" };
const C: GeoPoint = { lat: 32.78, lng: -96.80, label: "Dallas, TX" };

describe("validateDailyLog", () => {
  it("rejects logs that do not sum to 1440 minutes", () => {
    const out = runEngine({
      trip: { current: A, pickup: B, dropoff: C, cycleHoursUsed: 0 },
      route: { legs: [{ distance_mi: 0, duration_hr: 0 }, { distance_mi: 100, duration_hr: 2 }] },
      events: [],
      preferences: { stopStrategy: "auto", avgSpeedMph: 55 },
      now: "2026-04-28T08:00:00.000Z",
    });
    const log = out.dailyLogs[0];
    log.rows[0].totalMinutes -= 60;
    const v = validateDailyLog(log);
    expect(v.ok).toBe(false);
  });

  it("rejects rows with overlapping segments", () => {
    const out = runEngine({
      trip: { current: A, pickup: B, dropoff: C, cycleHoursUsed: 0 },
      route: { legs: [{ distance_mi: 0, duration_hr: 0 }, { distance_mi: 100, duration_hr: 2 }] },
      events: [],
      preferences: { stopStrategy: "auto", avgSpeedMph: 55 },
      now: "2026-04-28T08:00:00.000Z",
    });
    const log = out.dailyLogs[0];
    const drivingRow = log.rows.find(r => r.status === "driving")!;
    drivingRow.segments.push({ startMin: 100, endMin: 250, trueDurationMin: 150 });
    drivingRow.segments.push({ startMin: 200, endMin: 300, trueDurationMin: 100 });
    const v = validateDailyLog(log);
    expect(v.ok).toBe(false);
  });
});
