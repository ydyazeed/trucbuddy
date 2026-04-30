export type DutyStatus = "driving" | "on_duty" | "off_duty" | "sleeper";

export type StopCategory =
  | "drive"
  | "pickup"
  | "dropoff"
  | "fuel"
  | "break30"
  | "rest10"
  | "restart34"
  | "on_duty";

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface RouteLeg {
  distance_mi: number;
  duration_hr: number;
  geometry?: unknown;
}

export interface RoutePlan {
  legs: RouteLeg[];
}

export interface TripInputs {
  current: GeoPoint;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  cycleHoursUsed: number;
}

export interface TripEvent {
  id?: string;
  client_event_id: string;
  sequence_number?: number;
  event_type: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
}

export interface Preferences {
  stopStrategy: "auto" | "choice";
  avgSpeedMph: number;
}

export interface TimelineEntry {
  start: string; // ISO UTC
  end: string;   // ISO UTC
  status: DutyStatus;
  category: StopCategory;
  location: GeoPoint;
  /** Original engine-picked location. Preserved across stop swaps so the
   *  driver can always revert to the auto-picked location from the dropdown. */
  auto_location?: GeoPoint;
  distance_mi: number;
  planned: boolean;
  source: "engine" | "event";
  remark?: string;
}

export interface DailyLogRow {
  status: DutyStatus;
  /** segments in minutes from midnight (0..1440) on the 4-row grid */
  segments: { startMin: number; endMin: number; trueDurationMin: number; remark?: string }[];
  totalMinutes: number;
}

export interface DailyLogModel {
  log_date: string; // YYYY-MM-DD
  rows: DailyLogRow[];
  totals: { off_duty: number; sleeper: number; driving: number; on_duty: number };
  totalMinutes: number;
  remarks: { atMin: number; text: string }[];
  fields: {
    total_miles: number;
    truck_number?: string;
    trailer_number?: string;
    carrier_name?: string;
    carrier_address?: string;
    co_driver?: string;
    shipper?: string;
    shipping_doc?: string;
  };
}

export interface HOSClocks {
  drive11: number;       // minutes remaining of 11-hr drive
  window14: number;      // minutes remaining of 14-hr window
  cycle70: number;       // minutes remaining of 70-hr cycle
  sinceBreak8: number;   // minutes remaining before 8-hr drive without 30-min break
}

export type Feasibility = "ok" | "needs_restart" | "infeasible";

export interface UpcomingStop {
  nextRequiredStop: StopCategory;
  milesUntil: number;
  hoursUntil: number;
  reason: string;
}

export interface ReplanTrigger {
  reason: string;
  at: string;
}

export interface EngineInputs {
  trip: TripInputs;
  route: RoutePlan;
  events: TripEvent[];
  preferences: Preferences;
  /** ISO timestamp the planner uses as "now". Defaults to trip start at planning. */
  now?: string;
}

export interface EngineOutputs {
  schedule: TimelineEntry[];
  dailyLogs: DailyLogModel[];
  hosClocks: HOSClocks;
  feasibility: Feasibility;
  upcoming: UpcomingStop | null;
  replanTriggers: ReplanTrigger[];
  totals: { driveMin: number; onDutyMin: number; offDutyMin: number; distanceMi: number };
}
