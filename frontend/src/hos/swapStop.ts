import { RULES } from "./rules";
import type { GeoPoint, TimelineEntry } from "./types";

const ROAD_FACTOR = 1.18;

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function addMinutes(iso: string, min: number): string {
  return new Date(new Date(iso).getTime() + min * 60_000).toISOString();
}

/**
 * Swap a stop's location to a new POI and recompute downstream times.
 *
 *  - The drive segment immediately before the stop has its distance + duration
 *    recomputed from origin → new POI at avg-speed.
 *  - The stop's own duration is preserved; its start/end shift by the new
 *    drive duration delta.
 *  - All entries after the stop are shifted by the same delta.
 *
 * Pure: no fetch, no DOM. Same inputs → same outputs.
 */
export function swapStop(
  schedule: TimelineEntry[],
  stopIndex: number,
  newLocation: GeoPoint,
  tripStart: GeoPoint,
): TimelineEntry[] {
  const out = schedule.map(e => ({ ...e, location: { ...e.location } }));
  const stop = out[stopIndex];
  if (!stop) return schedule;

  let driveIdx = stopIndex - 1;
  while (driveIdx >= 0 && out[driveIdx].category !== "drive") driveIdx--;

  let timeDeltaMin = 0;

  if (driveIdx >= 0) {
    const drive = out[driveIdx];
    const origin = driveIdx > 0 ? out[driveIdx - 1].location : tripStart;
    const newDistMi = haversineMiles(origin, newLocation) * ROAD_FACTOR;
    const newDurMin = (newDistMi / RULES.AVG_SPEED_MPH) * 60;
    const oldDurMin = (new Date(drive.end).getTime() - new Date(drive.start).getTime()) / 60_000;
    timeDeltaMin = newDurMin - oldDurMin;
    drive.distance_mi = newDistMi;
    drive.end = addMinutes(drive.start, newDurMin);
    drive.location = { lat: newLocation.lat, lng: newLocation.lng, label: newLocation.label };
  }

  const stopDurMin = (new Date(stop.end).getTime() - new Date(stop.start).getTime()) / 60_000;
  const newStart = driveIdx >= 0 ? out[driveIdx].end : stop.start;
  stop.start = newStart;
  stop.end = addMinutes(newStart, stopDurMin);
  stop.location = { lat: newLocation.lat, lng: newLocation.lng, label: newLocation.label };

  for (let i = stopIndex + 1; i < out.length; i++) {
    out[i] = {
      ...out[i],
      start: addMinutes(out[i].start, timeDeltaMin),
      end: addMinutes(out[i].end, timeDeltaMin),
    };
  }

  return out;
}
