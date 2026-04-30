import { describe, expect, it } from "vitest";

import { replayEvents } from "../replay";
import { buildDailyLogs } from "../logs";
import type { TimelineEntry, TripEvent } from "../types";

const LOC = { lat: 41.88, lng: -87.63, label: "Chicago, IL" };

const planned: TimelineEntry[] = [
  {
    start: "2026-04-28T06:00:00.000Z",
    end: "2026-04-28T11:00:00.000Z",
    status: "driving",
    category: "drive",
    location: LOC,
    distance_mi: 275,
    planned: true,
    source: "engine",
  },
  {
    start: "2026-04-28T11:00:00.000Z",
    end: "2026-04-28T12:00:00.000Z",
    status: "on_duty",
    category: "pickup",
    location: LOC,
    distance_mi: 0,
    planned: true,
    source: "engine",
  },
];

function mkEvent(at: string, status: string): TripEvent {
  return {
    client_event_id: `cev-${at}`,
    event_type: "status_change",
    occurred_at: at,
    payload: { status },
  };
}

describe("replayEvents", () => {
  it("returns planned schedule unchanged when no events exist", () => {
    const out = replayEvents({ planned, events: [], now: "2026-04-28T07:00:00.000Z", tripStart: "2026-04-28T06:00:00.000Z" });
    expect(out).toEqual(planned);
  });

  it("inserts a pre-trip off-duty segment if first event is after trip start", () => {
    const out = replayEvents({
      planned,
      events: [mkEvent("2026-04-28T06:30:00.000Z", "driving")],
      now: "2026-04-28T07:00:00.000Z",
      tripStart: "2026-04-28T06:00:00.000Z",
    });
    expect(out[0].status).toBe("off_duty");
    expect(out[0].start).toBe("2026-04-28T06:00:00.000Z");
    expect(out[0].end).toBe("2026-04-28T06:30:00.000Z");
  });

  it("creates actualized segments from successive events and trims planned tail to >= now", () => {
    const out = replayEvents({
      planned,
      events: [
        mkEvent("2026-04-28T06:30:00.000Z", "driving"),
        mkEvent("2026-04-28T07:00:00.000Z", "off_duty"),
      ],
      now: "2026-04-28T08:00:00.000Z",
      tripStart: "2026-04-28T06:00:00.000Z",
    });
    const actualized = out.filter(e => e.source === "event");
    expect(actualized.length).toBeGreaterThanOrEqual(2);
    const kepts = out.filter(e => e.source === "engine");
    for (const k of kepts) {
      expect(new Date(k.start).getTime()).toBeGreaterThanOrEqual(new Date("2026-04-28T08:00:00.000Z").getTime());
    }
  });

  it("daily-log totals from a replayed schedule still sum to 24h", () => {
    const out = replayEvents({
      planned,
      events: [
        mkEvent("2026-04-28T06:30:00.000Z", "driving"),
        mkEvent("2026-04-28T08:00:00.000Z", "off_duty"),
      ],
      now: "2026-04-28T09:00:00.000Z",
      tripStart: "2026-04-28T06:00:00.000Z",
    });
    const logs = buildDailyLogs(out);
    for (const log of logs) {
      const sum = log.rows.reduce((s, r) => s + r.totalMinutes, 0);
      expect(sum).toBe(1440);
    }
  });
});
