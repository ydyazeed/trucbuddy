import { describe, expect, it } from "vitest";

import { swapStop } from "../swapStop";
import { buildDailyLogs } from "../logs";
import type { TimelineEntry } from "../types";

const ORIGIN = { lat: 41.88, lng: -87.63, label: "Chicago, IL" };
const FUEL_AT = { lat: 38.63, lng: -90.20, label: "St. Louis, MO" };

const schedule: TimelineEntry[] = [
  {
    start: "2026-04-28T06:00:00.000Z",
    end: "2026-04-28T11:00:00.000Z",
    status: "driving",
    category: "drive",
    location: FUEL_AT,
    distance_mi: 275,
    planned: true,
    source: "engine",
  },
  {
    start: "2026-04-28T11:00:00.000Z",
    end: "2026-04-28T11:30:00.000Z",
    status: "on_duty",
    category: "fuel",
    location: FUEL_AT,
    distance_mi: 0,
    planned: true,
    source: "engine",
  },
  {
    start: "2026-04-28T11:30:00.000Z",
    end: "2026-04-28T13:30:00.000Z",
    status: "driving",
    category: "drive",
    location: { lat: 35.0, lng: -92.0, label: "near Memphis" },
    distance_mi: 110,
    planned: true,
    source: "engine",
  },
];

describe("swapStop", () => {
  it("recomputes the preceding drive's duration and shifts downstream entries", () => {
    const newPOI = { lat: 39.5, lng: -89.5, label: "Effingham, IL" };
    const out = swapStop(schedule, 1, newPOI, ORIGIN);
    const newDrive = out[0];
    const oldDriveMin = (new Date(schedule[0].end).getTime() - new Date(schedule[0].start).getTime()) / 60000;
    const newDriveMin = (new Date(newDrive.end).getTime() - new Date(newDrive.start).getTime()) / 60000;
    expect(newDriveMin).not.toBe(oldDriveMin);
    expect(out[1].location.label).toBe("Effingham, IL");
    expect(new Date(out[1].start).getTime()).toBe(new Date(newDrive.end).getTime());
    const stopDur = (new Date(out[1].end).getTime() - new Date(out[1].start).getTime()) / 60000;
    expect(stopDur).toBe(30);
    const downstreamShift = new Date(out[2].start).getTime() - new Date(schedule[2].start).getTime();
    const driveShift = new Date(out[0].end).getTime() - new Date(schedule[0].end).getTime();
    expect(downstreamShift).toBe(driveShift);
  });

  it("daily-log totals after swap still sum to 24h", () => {
    const newPOI = { lat: 39.5, lng: -89.5, label: "Effingham, IL" };
    const out = swapStop(schedule, 1, newPOI, ORIGIN);
    const logs = buildDailyLogs(out);
    for (const log of logs) {
      const sum = log.rows.reduce((s, r) => s + r.totalMinutes, 0);
      expect(sum).toBe(1440);
    }
  });

  it("is a no-op for an out-of-range index", () => {
    const out = swapStop(schedule, 99, { lat: 1, lng: 1, label: "x" }, ORIGIN);
    expect(out).toBe(schedule);
  });

  it("preserves auto_location across a swap so the original can be reverted", () => {
    const withAuto = schedule.map(e => ({ ...e, auto_location: { ...e.location } }));
    const newPOI = { lat: 39.5, lng: -89.5, label: "Effingham, IL" };
    const out = swapStop(withAuto, 1, newPOI, ORIGIN);
    expect(out[1].auto_location).toEqual(withAuto[1].location);
    expect(out[1].location.label).toBe("Effingham, IL");
  });
});
