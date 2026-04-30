import type { DutyStatus, GeoPoint, StopCategory, TimelineEntry, TripEvent } from "./types";

interface ReplayInput {
  planned: TimelineEntry[];
  events: TripEvent[];
  now: string;
  tripStart: string;
}

function categoryFor(status: DutyStatus, durationMin: number): StopCategory {
  if (status === "driving") return "drive";
  if (status === "on_duty") return "on_duty";
  if (status === "sleeper") return "rest10";
  if (durationMin >= 10 * 60) return "rest10";
  return "break30";
}

function locationOf(event: TripEvent, fallback: GeoPoint): GeoPoint {
  const loc = event.payload?.location as { lat: number; lng: number } | null | undefined;
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    return { lat: loc.lat, lng: loc.lng, label: "GPS" };
  }
  return fallback;
}

/**
 * Fold actual `status_change` events into the planned schedule.
 *
 * Result = actualized portion (event-derived, from trip start → now) followed
 * by the untouched future portion of the planned schedule. Daily-log totals
 * stay accurate because `buildDailyLogs` fills any gap with off-duty padding.
 *
 * Pure: no React, no fetch. Deterministic for the same inputs.
 */
export function replayEvents({ planned, events, now, tripStart }: ReplayInput): TimelineEntry[] {
  const statusEvents = events
    .filter(e => e.event_type === "status_change")
    .slice()
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (statusEvents.length === 0) return planned;

  const nowMs = new Date(now).getTime();
  const tripStartMs = new Date(tripStart).getTime();
  const fallbackLoc: GeoPoint = planned[0]?.location ?? { lat: 0, lng: 0, label: "" };

  const actualized: TimelineEntry[] = [];

  const firstEventMs = new Date(statusEvents[0].occurred_at).getTime();
  if (firstEventMs > tripStartMs) {
    actualized.push({
      start: new Date(tripStartMs).toISOString(),
      end: new Date(firstEventMs).toISOString(),
      status: "off_duty",
      category: "break30",
      location: fallbackLoc,
      distance_mi: 0,
      planned: false,
      source: "event",
      remark: "Pre-trip off-duty",
    });
  }

  for (let i = 0; i < statusEvents.length; i++) {
    const event = statusEvents[i];
    const nextEvent = statusEvents[i + 1];
    const startMs = new Date(event.occurred_at).getTime();
    const endMs = nextEvent ? new Date(nextEvent.occurred_at).getTime() : Math.max(nowMs, startMs);
    if (endMs <= startMs) continue;
    const status = (event.payload?.status as DutyStatus) ?? "off_duty";
    const dur = (endMs - startMs) / 60_000;
    actualized.push({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      status,
      category: categoryFor(status, dur),
      location: locationOf(event, fallbackLoc),
      distance_mi: 0,
      planned: false,
      source: "event",
    });
  }

  const cutoffMs = Math.max(
    nowMs,
    actualized.length ? new Date(actualized[actualized.length - 1].end).getTime() : nowMs,
  );
  const tail = planned.filter(e => new Date(e.start).getTime() >= cutoffMs);

  return [...actualized, ...tail];
}
