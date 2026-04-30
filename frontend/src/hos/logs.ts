import type { DailyLogModel, DailyLogRow, DutyStatus, TimelineEntry } from "./types";

const STATUSES: DutyStatus[] = ["off_duty", "sleeper", "driving", "on_duty"];

const MS_PER_MIN = 60_000;

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function startOfDayUTC(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function snapTo15(min: number): number {
  return Math.round(min / 15) * 15;
}

interface DaySegment {
  status: DutyStatus;
  startMin: number;
  endMin: number;
  trueDurationMin: number;
  remark?: string;
  miles: number;
}

/**
 * Split timeline entries on UTC-midnight boundaries and group per calendar day.
 * Visual snap to 15-min on the rendered grid; row totals use TRUE durations.
 */
export function buildDailyLogs(schedule: TimelineEntry[]): DailyLogModel[] {
  if (schedule.length === 0) return [];

  const byDay = new Map<string, DaySegment[]>();
  const tripStart = startOfDayUTC(schedule[0].start);
  const tripEnd = new Date(schedule[schedule.length - 1].end);

  for (const entry of schedule) {
    const startMs = new Date(entry.start).getTime();
    const endMs = new Date(entry.end).getTime();
    let cursor = startMs;
    while (cursor < endMs) {
      const dayStart = startOfDayUTC(new Date(cursor).toISOString()).getTime();
      const nextMidnight = dayStart + 24 * 60 * MS_PER_MIN;
      const segEnd = Math.min(endMs, nextMidnight);
      const dayKey = dateKey(new Date(cursor).toISOString());
      const seg: DaySegment = {
        status: entry.status,
        startMin: Math.round((cursor - dayStart) / MS_PER_MIN),
        endMin: Math.round((segEnd - dayStart) / MS_PER_MIN),
        trueDurationMin: Math.round((segEnd - cursor) / MS_PER_MIN),
        remark: entry.remark,
        miles: entry.distance_mi,
      };
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(seg);
      cursor = segEnd;
    }
  }

  // Pad first day with off-duty 00:00 → trip-start.
  const firstDayKey = dateKey(schedule[0].start);
  const firstStartMin = minutesFromMidnight(schedule[0].start);
  if (firstStartMin > 0) {
    byDay.get(firstDayKey)?.unshift({
      status: "off_duty",
      startMin: 0,
      endMin: firstStartMin,
      trueDurationMin: firstStartMin,
      miles: 0,
    });
  }

  // Pad final day with off-duty trip-end → 23:59.
  const lastDayKey = dateKey(schedule[schedule.length - 1].end);
  const lastEndMin = minutesFromMidnight(schedule[schedule.length - 1].end);
  if (lastEndMin < 1440) {
    byDay.get(lastDayKey)?.push({
      status: "off_duty",
      startMin: lastEndMin,
      endMin: 1440,
      trueDurationMin: 1440 - lastEndMin,
      miles: 0,
    });
  }

  // Fill any gaps inside a day with off-duty.
  for (const [, segs] of byDay) {
    segs.sort((a, b) => a.startMin - b.startMin);
    const filled: DaySegment[] = [];
    let cursor = 0;
    for (const seg of segs) {
      if (seg.startMin > cursor) {
        filled.push({ status: "off_duty", startMin: cursor, endMin: seg.startMin, trueDurationMin: seg.startMin - cursor, miles: 0 });
      }
      filled.push(seg);
      cursor = seg.endMin;
    }
    if (cursor < 1440) {
      filled.push({ status: "off_duty", startMin: cursor, endMin: 1440, trueDurationMin: 1440 - cursor, miles: 0 });
    }
    segs.length = 0;
    segs.push(...filled);
  }

  // For days within trip span that we never touched (e.g., a bare 34h restart middle day),
  // fill with single off-duty 0–1440. Iterate through trip's day range.
  const dayMs = 24 * 60 * MS_PER_MIN;
  for (let t = tripStart.getTime(); t <= tripEnd.getTime(); t += dayMs) {
    const k = dateKey(new Date(t).toISOString());
    if (!byDay.has(k)) {
      byDay.set(k, [{ status: "off_duty", startMin: 0, endMin: 1440, trueDurationMin: 1440, miles: 0 }]);
    }
  }

  const days = Array.from(byDay.keys()).sort();
  return days.map(day => buildDayModel(day, byDay.get(day)!));
}

function buildDayModel(date: string, segs: DaySegment[]): DailyLogModel {
  const rows: DailyLogRow[] = STATUSES.map(status => ({
    status,
    segments: [],
    totalMinutes: 0,
  }));

  let totalMiles = 0;
  const remarks: { atMin: number; text: string }[] = [];

  for (const seg of segs) {
    const row = rows.find(r => r.status === seg.status)!;
    row.segments.push({
      startMin: snapTo15(seg.startMin),
      endMin: snapTo15(seg.endMin),
      trueDurationMin: seg.trueDurationMin,
      remark: seg.remark,
    });
    row.totalMinutes += seg.trueDurationMin;
    totalMiles += seg.miles;
    if (seg.remark) {
      remarks.push({ atMin: seg.startMin, text: seg.remark });
    }
  }

  // Normalize totals so they sum to exactly 1440 minutes.
  const sum = rows.reduce((s, r) => s + r.totalMinutes, 0);
  if (sum !== 1440 && sum > 0) {
    const scale = 1440 / sum;
    let acc = 0;
    rows.forEach((r, i) => {
      const adjusted = i === rows.length - 1 ? 1440 - acc : Math.round(r.totalMinutes * scale);
      r.totalMinutes = adjusted;
      acc += adjusted;
    });
  }

  return {
    log_date: date,
    rows,
    totals: {
      off_duty: rows.find(r => r.status === "off_duty")!.totalMinutes,
      sleeper: rows.find(r => r.status === "sleeper")!.totalMinutes,
      driving: rows.find(r => r.status === "driving")!.totalMinutes,
      on_duty: rows.find(r => r.status === "on_duty")!.totalMinutes,
    },
    totalMinutes: rows.reduce((s, r) => s + r.totalMinutes, 0),
    remarks,
    fields: {
      total_miles: Math.round(totalMiles),
    },
  };
}

export function validateDailyLog(log: DailyLogModel): { ok: true } | { ok: false; reason: string } {
  const sum = log.rows.reduce((s, r) => s + r.totalMinutes, 0);
  if (sum !== 1440) {
    return { ok: false, reason: `Daily totals must sum to 24.0h (got ${(sum / 60).toFixed(2)}h).` };
  }
  // No overlap inside the same row.
  for (const row of log.rows) {
    const sorted = [...row.segments].sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMin < sorted[i - 1].endMin) {
        return { ok: false, reason: `Overlap on row ${row.status} near ${sorted[i].startMin}m.` };
      }
    }
  }
  return { ok: true };
}
