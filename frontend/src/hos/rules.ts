/**
 * HOS rules constants. All durations in minutes unless noted.
 */
export const RULES = {
  AVG_SPEED_MPH: 55,
  DRIVE_LIMIT_MIN: 11 * 60,
  WINDOW_LIMIT_MIN: 14 * 60,
  CYCLE_LIMIT_MIN: 70 * 60,
  CYCLE_DAYS: 8,
  BREAK_AFTER_DRIVE_MIN: 8 * 60,
  BREAK_DURATION_MIN: 30,
  REST_MIN: 10 * 60,
  RESTART_MIN: 34 * 60,
  PICKUP_DROPOFF_MIN: 60,
  FUEL_INTERVAL_MI: 1000,
  FUEL_DURATION_MIN: 30,
  FUEL_COMBINE_WINDOW_MIN: 30,
  // Buffer guidance: leave room for variability, target ~10.5h usable on 14h window.
  WINDOW_USABLE_BUFFER_MIN: 14 * 60 - 10.5 * 60,
  ZONE_GREEN_MIN: 90,
  ZONE_RED_MIN: 15,
} as const;

export type Zone = "green" | "amber" | "red";

export function classifyZone(minutesRemaining: number): Zone {
  if (minutesRemaining <= RULES.ZONE_RED_MIN) return "red";
  if (minutesRemaining < RULES.ZONE_GREEN_MIN) return "amber";
  return "green";
}
