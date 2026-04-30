import { RULES } from "./rules";
import type {
  DutyStatus,
  EngineInputs,
  Feasibility,
  GeoPoint,
  HOSClocks,
  StopCategory,
  TimelineEntry,
  UpcomingStop,
} from "./types";

const MIN_PER_HR = 60;

function addMinutesISO(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

function midpoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    label: t < 0.5 ? a.label : b.label,
  };
}

interface PlannerState {
  cursor: string;
  driveMinSinceReset: number;     // minutes driven since last 10h reset
  windowMinSinceOnDuty: number;   // minutes elapsed in current 14h window
  driveMinSinceBreak: number;     // drive minutes since last >=30m non-driving period
  cycleMinUsed: number;           // running 70/8 cycle usage
  milesDrivenSinceFuel: number;
  totalDistance: number;
  schedule: TimelineEntry[];
  feasibility: Feasibility;
}

function mkEntry(
  start: string,
  end: string,
  status: DutyStatus,
  category: StopCategory,
  location: GeoPoint,
  distance_mi: number,
  remark?: string,
): TimelineEntry {
  return {
    start,
    end,
    status,
    category,
    location,
    auto_location: { ...location },
    distance_mi,
    planned: true,
    source: "engine",
    remark,
  };
}

function appendEntry(state: PlannerState, entry: TimelineEntry): void {
  const prev = state.schedule[state.schedule.length - 1];
  if (prev && prev.status === entry.status && prev.category === entry.category && prev.end === entry.start) {
    prev.end = entry.end;
    prev.distance_mi += entry.distance_mi;
    return;
  }
  state.schedule.push(entry);
}

function composeRemark(location: GeoPoint, activity?: string): string | undefined {
  const label = location.label?.trim();
  if (!activity) return label || undefined;
  if (!label) return activity;
  return `${label} — ${activity}`;
}

function applyDuty(state: PlannerState, durationMin: number, status: DutyStatus, category: StopCategory, location: GeoPoint, distance_mi: number, remark?: string): void {
  if (durationMin <= 0) return;
  const start = state.cursor;
  const end = addMinutesISO(start, durationMin);
  const composed = remark ? composeRemark(location, remark) : undefined;
  appendEntry(state, mkEntry(start, end, status, category, location, distance_mi, composed));
  state.cursor = end;

  // Cycle counts on/driving as on-duty time.
  if (status === "driving" || status === "on_duty") {
    state.cycleMinUsed += durationMin;
    state.windowMinSinceOnDuty += durationMin;
  } else {
    // Off-duty / sleeper: 10h+ resets drive & window; >=30m non-driving counts as break.
    if (durationMin >= RULES.REST_MIN) {
      state.driveMinSinceReset = 0;
      state.windowMinSinceOnDuty = 0;
      state.driveMinSinceBreak = 0;
    } else if (durationMin >= RULES.BREAK_DURATION_MIN) {
      state.driveMinSinceBreak = 0;
    }
  }

  if (status === "driving") {
    state.driveMinSinceReset += durationMin;
    state.driveMinSinceBreak += durationMin;
    state.totalDistance += distance_mi;
    state.milesDrivenSinceFuel += distance_mi;
  } else if (status === "on_duty" && durationMin >= RULES.BREAK_DURATION_MIN) {
    // on-duty (not driving) >= 30 min satisfies break-after-8 rule (permissive).
    state.driveMinSinceBreak = 0;
  }
}

interface PlanLegOpts {
  origin: GeoPoint;
  destination: GeoPoint;
  distance_mi: number;
}

function driveMinutesFromMiles(miles: number): number {
  return Math.round((miles / RULES.AVG_SPEED_MPH) * MIN_PER_HR);
}

function planLeg(state: PlannerState, leg: PlanLegOpts): void {
  let remainingMi = leg.distance_mi;
  let lastPoint: GeoPoint = leg.origin;

  while (remainingMi > 0.01 && state.feasibility !== "infeasible") {
    const remainingDriveMin = Math.max(0, RULES.DRIVE_LIMIT_MIN - state.driveMinSinceReset);
    const remainingWindowMin = Math.max(0, RULES.WINDOW_LIMIT_MIN - state.windowMinSinceOnDuty);
    const remainingBreakMin = Math.max(0, RULES.BREAK_AFTER_DRIVE_MIN - state.driveMinSinceBreak);
    const remainingCycleMin = Math.max(0, RULES.CYCLE_LIMIT_MIN - state.cycleMinUsed);
    const milesToFuel = Math.max(0, RULES.FUEL_INTERVAL_MI - state.milesDrivenSinceFuel);

    if (remainingCycleMin <= 0) {
      // Need 34h restart.
      applyDuty(state, RULES.RESTART_MIN, "off_duty", "restart34", lastPoint, 0, "34h cycle restart");
      state.cycleMinUsed = 0;
      state.driveMinSinceReset = 0;
      state.windowMinSinceOnDuty = 0;
      state.driveMinSinceBreak = 0;
      continue;
    }

    if (remainingDriveMin <= 0 || remainingWindowMin <= 0) {
      applyDuty(state, RULES.REST_MIN, "off_duty", "rest10", lastPoint, 0, "10h off-duty");
      continue;
    }

    if (remainingBreakMin <= 0) {
      // Try to combine with fuel if due within window.
      const willCombineFuel = milesToFuel <= 50;
      if (willCombineFuel) {
        applyDuty(state, RULES.FUEL_DURATION_MIN, "on_duty", "fuel", lastPoint, 0, "Fuel + 30m break");
        state.milesDrivenSinceFuel = 0;
      } else {
        applyDuty(state, RULES.BREAK_DURATION_MIN, "off_duty", "break30", lastPoint, 0, "30-min break");
      }
      continue;
    }

    // Drive a chunk, bounded by next constraint.
    const milesByDrive = (remainingDriveMin / MIN_PER_HR) * RULES.AVG_SPEED_MPH;
    const milesByWindow = (remainingWindowMin / MIN_PER_HR) * RULES.AVG_SPEED_MPH;
    const milesByBreak = (remainingBreakMin / MIN_PER_HR) * RULES.AVG_SPEED_MPH;
    const milesByCycle = (remainingCycleMin / MIN_PER_HR) * RULES.AVG_SPEED_MPH;
    const milesByFuel = milesToFuel > 0 ? milesToFuel : RULES.FUEL_INTERVAL_MI;
    const chunkMi = Math.min(remainingMi, milesByDrive, milesByWindow, milesByBreak, milesByCycle, milesByFuel);

    if (chunkMi <= 0.01) {
      state.feasibility = "infeasible";
      break;
    }

    const chunkMin = driveMinutesFromMiles(chunkMi);
    const t = leg.distance_mi > 0 ? 1 - (remainingMi - chunkMi) / leg.distance_mi : 1;
    const segEnd = midpoint(leg.origin, leg.destination, Math.min(1, Math.max(0, t)));
    applyDuty(state, chunkMin, "driving", "drive", segEnd, chunkMi);

    remainingMi -= chunkMi;
    lastPoint = segEnd;

    if (state.milesDrivenSinceFuel >= RULES.FUEL_INTERVAL_MI - 0.5 && remainingMi > 1) {
      applyDuty(state, RULES.FUEL_DURATION_MIN, "on_duty", "fuel", lastPoint, 0, "Fuel stop");
      state.milesDrivenSinceFuel = 0;
    }
  }
}

function clocksFromState(state: PlannerState): HOSClocks {
  return {
    drive11: Math.max(0, RULES.DRIVE_LIMIT_MIN - state.driveMinSinceReset),
    window14: Math.max(0, RULES.WINDOW_LIMIT_MIN - state.windowMinSinceOnDuty),
    cycle70: Math.max(0, RULES.CYCLE_LIMIT_MIN - state.cycleMinUsed),
    sinceBreak8: Math.max(0, RULES.BREAK_AFTER_DRIVE_MIN - state.driveMinSinceBreak),
  };
}

function computeUpcoming(state: PlannerState): UpcomingStop | null {
  const remainingDrive = RULES.DRIVE_LIMIT_MIN - state.driveMinSinceReset;
  const remainingBreak = RULES.BREAK_AFTER_DRIVE_MIN - state.driveMinSinceBreak;
  const remainingWindow = RULES.WINDOW_LIMIT_MIN - state.windowMinSinceOnDuty;
  const milesToFuel = RULES.FUEL_INTERVAL_MI - state.milesDrivenSinceFuel;

  const candidates: { mins: number; cat: StopCategory; reason: string; miles: number }[] = [
    { mins: remainingBreak, cat: "break30", reason: "30-min break", miles: (remainingBreak / 60) * RULES.AVG_SPEED_MPH },
    { mins: remainingDrive, cat: "rest10", reason: "10-hr off-duty", miles: (remainingDrive / 60) * RULES.AVG_SPEED_MPH },
    { mins: remainingWindow, cat: "rest10", reason: "End of 14-hr window", miles: (remainingWindow / 60) * RULES.AVG_SPEED_MPH },
    { mins: (milesToFuel / RULES.AVG_SPEED_MPH) * 60, cat: "fuel", reason: "Fuel stop", miles: milesToFuel },
  ];
  candidates.sort((a, b) => a.mins - b.mins);
  const next = candidates[0];
  if (!next || next.mins <= 0) return null;
  return {
    nextRequiredStop: next.cat,
    milesUntil: Math.round(next.miles),
    hoursUntil: Math.round((next.mins / 60) * 10) / 10,
    reason: next.reason,
  };
}

export function buildSchedule(input: EngineInputs): {
  schedule: TimelineEntry[];
  clocks: HOSClocks;
  feasibility: Feasibility;
  upcoming: UpcomingStop | null;
  totals: { driveMin: number; onDutyMin: number; offDutyMin: number; distanceMi: number };
} {
  const cycleUsedMin = Math.max(0, Math.min(RULES.CYCLE_LIMIT_MIN, input.trip.cycleHoursUsed * 60));
  const tripStart = input.now ?? new Date(Date.UTC(2026, 3, 28, 6, 0, 0)).toISOString();

  const state: PlannerState = {
    cursor: tripStart,
    driveMinSinceReset: 0,
    windowMinSinceOnDuty: 0,
    driveMinSinceBreak: 0,
    cycleMinUsed: cycleUsedMin,
    milesDrivenSinceFuel: 0,
    totalDistance: 0,
    schedule: [],
    feasibility: "ok",
  };

  const { current, pickup, dropoff } = input.trip;

  // 1. Deadhead from current to pickup (if different).
  const deadheadMi = input.route.legs[0]?.distance_mi ?? 0;
  if (deadheadMi > 0.5) {
    planLeg(state, { origin: current, destination: pickup, distance_mi: deadheadMi });
  }

  // 2. Pickup: 1h on-duty.
  applyDuty(state, RULES.PICKUP_DROPOFF_MIN, "on_duty", "pickup", pickup, 0, "Pickup loading");

  // 3. Loaded leg from pickup to dropoff.
  const loadedMi = input.route.legs[1]?.distance_mi ?? 0;
  if (loadedMi > 0.5) {
    planLeg(state, { origin: pickup, destination: dropoff, distance_mi: loadedMi });
  }

  // 4. Dropoff: 1h on-duty.
  applyDuty(state, RULES.PICKUP_DROPOFF_MIN, "on_duty", "dropoff", dropoff, 0, "Dropoff unloading");

  // Determine final feasibility:
  if (state.feasibility !== "infeasible") {
    if (state.cycleMinUsed >= RULES.CYCLE_LIMIT_MIN) state.feasibility = "needs_restart";
  }

  return {
    schedule: state.schedule,
    clocks: clocksFromState(state),
    feasibility: state.feasibility,
    upcoming: computeUpcoming(state),
    totals: {
      driveMin: state.schedule.filter(e => e.status === "driving").reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0),
      onDutyMin: state.schedule.filter(e => e.status === "on_duty").reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0),
      offDutyMin: state.schedule.filter(e => e.status === "off_duty" || e.status === "sleeper").reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0),
      distanceMi: state.totalDistance,
    },
  };
}
