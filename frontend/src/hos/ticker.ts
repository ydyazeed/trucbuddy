import { useEffect, useMemo, useState } from "react";

import { RULES } from "./rules";
import type { DutyStatus, HOSClocks } from "./types";

export interface DeriveTickerInput {
  base: HOSClocks;
  currentStatus: DutyStatus;
  statusSince: string | null;
  now: number;
}

/**
 * Pure derivation of live HOS clocks from a base snapshot + the current duty status'
 * elapsed time. Stored Trip.plan stays the source of truth for `base`; this function
 * applies real-time decay/reset rules per FMCSA hours-of-service:
 *
 *  - driving:   drive11, window14, sinceBreak8, cycle70 all decrement
 *  - on_duty:   window14, cycle70 decrement; >=30m resets sinceBreak8
 *  - off_duty / sleeper: all freeze. >=30m non-driving resets sinceBreak8.
 *                          >=10h off-duty resets drive11 + window14 + sinceBreak8.
 */
export function deriveLiveClocks(input: DeriveTickerInput): HOSClocks {
  const { base, currentStatus, statusSince, now } = input;
  if (!statusSince) return base;
  const elapsedMin = (now - new Date(statusSince).getTime()) / 60_000;
  if (!Number.isFinite(elapsedMin) || elapsedMin <= 0) return base;

  let { drive11, window14, sinceBreak8, cycle70 } = base;

  if (currentStatus === "driving") {
    drive11 = Math.max(0, drive11 - elapsedMin);
    window14 = Math.max(0, window14 - elapsedMin);
    sinceBreak8 = Math.max(0, sinceBreak8 - elapsedMin);
    cycle70 = Math.max(0, cycle70 - elapsedMin);
  } else if (currentStatus === "on_duty") {
    window14 = Math.max(0, window14 - elapsedMin);
    cycle70 = Math.max(0, cycle70 - elapsedMin);
    if (elapsedMin >= RULES.BREAK_DURATION_MIN) sinceBreak8 = RULES.BREAK_AFTER_DRIVE_MIN;
  } else {
    // off_duty / sleeper
    if (elapsedMin >= RULES.REST_MIN) {
      drive11 = RULES.DRIVE_LIMIT_MIN;
      window14 = RULES.WINDOW_LIMIT_MIN;
      sinceBreak8 = RULES.BREAK_AFTER_DRIVE_MIN;
    } else if (elapsedMin >= RULES.BREAK_DURATION_MIN) {
      sinceBreak8 = RULES.BREAK_AFTER_DRIVE_MIN;
    }
  }

  return { drive11, window14, sinceBreak8, cycle70 };
}

export interface LiveUpcoming {
  reason: string;
  minutesUntil: number;
  totalMin: number;
}

const CANDIDATES: { key: keyof HOSClocks; reason: string; total: number }[] = [
  { key: "sinceBreak8", reason: "30-min break", total: RULES.BREAK_AFTER_DRIVE_MIN },
  { key: "drive11", reason: "10-hr off-duty (drive limit)", total: RULES.DRIVE_LIMIT_MIN },
  { key: "window14", reason: "End of 14-hr window", total: RULES.WINDOW_LIMIT_MIN },
  { key: "cycle70", reason: "34-hr cycle restart", total: RULES.CYCLE_LIMIT_MIN },
];

export function liveUpcoming(clocks: HOSClocks): LiveUpcoming | null {
  let best: LiveUpcoming | null = null;
  for (const c of CANDIDATES) {
    const min = clocks[c.key];
    if (best == null || min < best.minutesUntil) {
      best = { reason: c.reason, minutesUntil: min, totalMin: c.total };
    }
  }
  return best;
}

export function useHosTicker(
  base: HOSClocks,
  currentStatus: DutyStatus,
  statusSince: string | null,
  intervalMs = 1000,
  externalNow?: number,
): HOSClocks {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (externalNow !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, externalNow]);
  const now = externalNow ?? tick;
  return useMemo(
    () => deriveLiveClocks({ base, currentStatus, statusSince, now }),
    [base, currentStatus, statusSince, now],
  );
}
