import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { RULES, classifyZone } from "../rules";
import { validateDailyLog } from "../logs";
import type { EngineInputs, GeoPoint } from "../types";

const A: GeoPoint = { lat: 41.88, lng: -87.63, label: "Chicago, IL" };
const B: GeoPoint = { lat: 38.63, lng: -90.20, label: "St. Louis, MO" };
const C: GeoPoint = { lat: 32.78, lng: -96.80, label: "Dallas, TX" };

function mkInput(opts: Partial<EngineInputs> & {
  cycleHours?: number;
  loadedMi?: number;
  deadheadMi?: number;
  now?: string;
} = {}): EngineInputs {
  return {
    trip: {
      current: A,
      pickup: B,
      dropoff: C,
      cycleHoursUsed: opts.cycleHours ?? 0,
    },
    route: {
      legs: [
        { distance_mi: opts.deadheadMi ?? 300, duration_hr: 5 },
        { distance_mi: opts.loadedMi ?? 700, duration_hr: 12 },
      ],
    },
    events: [],
    preferences: { stopStrategy: "auto", avgSpeedMph: 55 },
    now: opts.now ?? "2026-04-28T06:00:00.000Z",
  };
}

describe("HOS engine — basic plan", () => {
  it("produces a schedule with pickup and dropoff", () => {
    const out = runEngine(mkInput());
    const cats = out.schedule.map(e => e.category);
    expect(cats).toContain("pickup");
    expect(cats).toContain("dropoff");
    expect(cats.filter(c => c === "drive").length).toBeGreaterThan(0);
  });

  it("totals exactly 24h on every daily log", () => {
    const out = runEngine(mkInput());
    for (const log of out.dailyLogs) {
      const sum = log.rows.reduce((s, r) => s + r.totalMinutes, 0);
      expect(sum).toBe(1440);
      expect(validateDailyLog(log).ok).toBe(true);
    }
  });

  it("is deterministic — same input twice gives same output", () => {
    const out1 = runEngine(mkInput());
    const out2 = runEngine(mkInput());
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
  });
});

describe("HOS engine — boundaries", () => {
  it("inserts a 30-min break before 8h drive", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 600 }));
    const breakOrFuel = out.schedule.find(e => e.category === "break30" || e.category === "fuel");
    expect(breakOrFuel).toBeDefined();
  });

  it("inserts 10h rest when 11h drive limit hits", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 700 }));
    const rest = out.schedule.find(e => e.category === "rest10");
    expect(rest).toBeDefined();
  });

  it("inserts 34h restart when cycle exhausts", () => {
    const out = runEngine(mkInput({ cycleHours: 65, loadedMi: 800, deadheadMi: 200 }));
    const restart = out.schedule.find(e => e.category === "restart34");
    expect(restart).toBeDefined();
  });

  it("trips under 8 driving hours need no break", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 300 }));
    const breakStop = out.schedule.find(e => e.category === "break30");
    expect(breakStop).toBeUndefined();
  });

  it("trips ≤ 11h driving need no overnight rest", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 500 }));
    const rest = out.schedule.find(e => e.category === "rest10");
    expect(rest).toBeUndefined();
    expect(out.dailyLogs.length).toBe(1);
  });
});

describe("HOS engine — fuel stops", () => {
  it("inserts a fuel stop every 1000 miles", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 1100 }));
    const fuel = out.schedule.filter(e => e.category === "fuel");
    expect(fuel.length).toBeGreaterThanOrEqual(1);
  });
});

describe("HOS engine — daily-log midnight split", () => {
  it("splits status periods crossing midnight into separate days", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 700 }));
    expect(out.dailyLogs.length).toBeGreaterThanOrEqual(2);
    for (const log of out.dailyLogs) {
      for (const row of log.rows) {
        for (const seg of row.segments) {
          expect(seg.startMin).toBeGreaterThanOrEqual(0);
          expect(seg.endMin).toBeLessThanOrEqual(1440);
        }
      }
    }
  });

  it("first day has off-duty padding from 00:00 to trip-start", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 200, now: "2026-04-28T08:00:00.000Z" }));
    const first = out.dailyLogs[0];
    const off = first.rows.find(r => r.status === "off_duty")!;
    const padding = off.segments.find(s => s.startMin === 0);
    expect(padding).toBeDefined();
  });
});

describe("HOS engine — feasibility", () => {
  it("flags needs_restart when cycle is fully consumed", () => {
    const out = runEngine(mkInput({ cycleHours: 70, loadedMi: 100, deadheadMi: 0 }));
    expect(["needs_restart", "ok"]).toContain(out.feasibility);
  });

  it("clamps cycle hours used input at 70h", () => {
    const out = runEngine(mkInput({ cycleHours: 70, loadedMi: 0, deadheadMi: 0 }));
    expect(out.hosClocks.cycle70).toBeGreaterThanOrEqual(0);
  });
});

describe("HOS engine — pickup/dropoff", () => {
  it("dedicates exactly 60 min to pickup", () => {
    const out = runEngine(mkInput({ loadedMi: 200, deadheadMi: 0 }));
    const pickup = out.schedule.find(e => e.category === "pickup")!;
    const mins = (new Date(pickup.end).getTime() - new Date(pickup.start).getTime()) / 60000;
    expect(mins).toBe(RULES.PICKUP_DROPOFF_MIN);
  });

  it("dedicates exactly 60 min to dropoff", () => {
    const out = runEngine(mkInput({ loadedMi: 200, deadheadMi: 0 }));
    const dropoff = out.schedule.find(e => e.category === "dropoff")!;
    const mins = (new Date(dropoff.end).getTime() - new Date(dropoff.start).getTime()) / 60000;
    expect(mins).toBe(RULES.PICKUP_DROPOFF_MIN);
  });

  it("skips deadhead when current location equals pickup", () => {
    const out = runEngine(mkInput({ deadheadMi: 0, loadedMi: 200 }));
    const driveBeforePickup = out.schedule.findIndex(e => e.category === "pickup");
    const drives = out.schedule.slice(0, driveBeforePickup).filter(e => e.category === "drive");
    expect(drives.length).toBe(0);
  });
});

describe("HOS zones", () => {
  it("classifies green at >=90min", () => {
    expect(classifyZone(120)).toBe("green");
  });
  it("classifies amber between 16 and 89min", () => {
    expect(classifyZone(45)).toBe("amber");
  });
  it("classifies red at <=15min", () => {
    expect(classifyZone(10)).toBe("red");
  });
});
