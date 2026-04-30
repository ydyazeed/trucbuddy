import { useEffect, useMemo, useState } from "react";

import { findStops, type POI } from "@/poi/overpass";
import type { GeoPoint, TimelineEntry } from "@/hos/types";
import { reverseGeocode } from "@/geocode/photon";

const ROAD_FACTOR = 1.18;
const HOS_TOLERANCE_MI = 10;

export interface RequiredStop {
  scheduleIndex: number;
  entry: TimelineEntry;
  cumulativeMi: number;
  uiIndex: number;
  origin: GeoPoint;
  /** Max drivable distance from origin to this stop given current HOS state.
   *  Equal to the auto-picked drive's distance, which is engine-bounded by HOS. */
  maxDriveMi: number;
}

export interface POIWithStatus extends POI {
  distanceFromOriginMi: number;
  outsideHos: boolean;
}

export interface StopOptionList {
  items: POIWithStatus[];
  hasAlternatives: boolean;
  isSwapped: boolean;
}

const AUTO_PREFIX = "auto-";

function isSameLocation(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

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

async function autoPickPOI(entry: TimelineEntry): Promise<POI | null> {
  const auto = entry.auto_location ?? entry.location;
  if (!auto) return null;
  const rev = await reverseGeocode({ lat: auto.lat, lng: auto.lng });
  const cityState = [rev.city, rev.state].filter(Boolean).join(", ");
  const name = cityState || auto.label || "Auto-picked stop";
  return {
    id: `${AUTO_PREFIX}${auto.lat.toFixed(4)},${auto.lng.toFixed(4)}`,
    name: `Auto-pick · ${name}`,
    lat: auto.lat,
    lng: auto.lng,
    kind: "milestone",
    city: rev.city,
    state: rev.state,
  };
}

export function useStopOptions(schedule: TimelineEntry[]) {
  const required = useMemo<RequiredStop[]>(() => {
    let cum = 0;
    const out: RequiredStop[] = [];
    schedule.forEach((entry, scheduleIndex) => {
      if (entry.category === "drive") {
        cum += entry.distance_mi;
        return;
      }
      if (!["fuel", "break30", "rest10", "restart34"].includes(entry.category)) return;

      let driveIdx = scheduleIndex - 1;
      while (driveIdx >= 0 && schedule[driveIdx].category !== "drive") driveIdx--;
      const origin: GeoPoint =
        driveIdx > 0
          ? schedule[driveIdx - 1].location
          : driveIdx === 0
            ? schedule[0].location
            : entry.location;
      const maxDriveMi = driveIdx >= 0 ? schedule[driveIdx].distance_mi : 0;
      out.push({
        scheduleIndex,
        entry,
        cumulativeMi: cum,
        uiIndex: out.length,
        origin,
        maxDriveMi,
      });
    });
    return out;
  }, [schedule]);

  const [pois, setPois] = useState<Record<string, StopOptionList>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all(
      required.map(async ({ entry, uiIndex, origin, maxDriveMi }) => {
        const auto = entry.auto_location ?? entry.location;
        const radius = entry.category === "fuel" ? 15 : 10;
        const found = await findStops(auto, radius, entry.category);
        const enriched: POIWithStatus[] = found.slice(0, 8).map(p => {
          const distMi = haversineMiles(origin, { lat: p.lat, lng: p.lng }) * ROAD_FACTOR;
          return {
            ...p,
            distanceFromOriginMi: distMi,
            outsideHos: maxDriveMi > 0 && distMi > maxDriveMi + HOS_TOLERANCE_MI,
          };
        });
        const hasAlternatives = enriched.length > 0;
        const items: POIWithStatus[] = hasAlternatives ? enriched : [];
        const isSwapped = !isSameLocation(auto, entry.location);
        if (isSwapped) {
          const autoOption = await autoPickPOI(entry);
          if (autoOption && !items.some(p => p.id === autoOption.id)) {
            items.unshift({
              ...autoOption,
              distanceFromOriginMi: maxDriveMi,
              outsideHos: false,
            });
          }
        }
        return [String(uiIndex), { items, hasAlternatives, isSwapped }] as const;
      }),
    )
      .then(entries => {
        if (cancel) return;
        const map: Record<string, StopOptionList> = {};
        for (const [k, v] of entries) map[k] = v;
        setPois(map);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [
    JSON.stringify(
      required.map(r => {
        const a = r.entry.auto_location ?? r.entry.location;
        return `${a.lat},${a.lng}|${r.entry.location.lat},${r.entry.location.lng}|${r.maxDriveMi}|${r.origin.lat},${r.origin.lng}`;
      }),
    ),
  ]);

  return { required, pois, loading };
}
