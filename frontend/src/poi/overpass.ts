import type { GeoPoint, StopCategory } from "@/hos/types";
import { reverseGeocode } from "@/geocode/photon";

const ENDPOINT = "https://overpass.kumi.systems/api/interpreter";
const TIMEOUT_MS = 3000;

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "fuel" | "services" | "parking" | "milestone";
  city?: string;
  state?: string;
}

const CACHE_KEY = "truc_poi_cache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  ts: number;
  pois: POI[];
}

function loadCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCache(c: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function cacheKey(center: GeoPoint, radiusMi: number, type: StopCategory): string {
  return `${type}:${center.lat.toFixed(2)},${center.lng.toFixed(2)}:${radiusMi.toFixed(0)}`;
}

export async function findStops(
  center: GeoPoint,
  radiusMi: number,
  type: StopCategory,
): Promise<POI[]> {
  const key = cacheKey(center, radiusMi, type);
  const cache = loadCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.pois;

  const radiusMeters = Math.round(radiusMi * 1609.34);
  const aroundFuel = `(around:${radiusMeters},${center.lat},${center.lng})`;
  const filters = type === "fuel"
    ? [
        `node["amenity"="fuel"]${aroundFuel}`,
        `way["amenity"="fuel"]${aroundFuel}`,
        `node["amenity"="truck_stop"]${aroundFuel}`,
      ].join(";") + ";"
    : [
        `node["amenity"="parking"]${aroundFuel}`,
        `way["amenity"="parking"]${aroundFuel}`,
        `node["highway"="services"]${aroundFuel}`,
        `node["highway"="rest_area"]${aroundFuel}`,
        `node["amenity"="truck_stop"]${aroundFuel}`,
      ].join(";") + ";";
  const query = `[out:json][timeout:${Math.round(TIMEOUT_MS / 1000)}];(${filters});out center 20;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const pois: POI[] = (data.elements ?? [])
      .map((el: any) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat == null || lng == null) return null;
        if (el.tags?.hgv === "no") return null;
        const tags = el.tags ?? {};
        const kind: POI["kind"] =
          tags.amenity === "fuel"
            ? "fuel"
            : tags.highway === "services" || tags.highway === "rest_area" || tags.amenity === "truck_stop"
              ? "services"
              : "parking";
        return {
          id: `${el.type}-${el.id}`,
          name: tags.name || tags.brand || tags.operator || "",
          lat,
          lng,
          kind,
          city: tags["addr:city"],
          state: tags["addr:state"],
        } as POI;
      })
      .filter((p: POI | null): p is POI => p !== null)
      .slice(0, 12);
    await Promise.all(
      pois.map(async (p, i) => {
        if (p.name) return;
        try {
          const rev = await reverseGeocode({ lat: p.lat, lng: p.lng });
          const cityState = [rev.city, rev.state].filter(Boolean).join(", ");
          const kindLabel =
            p.kind === "fuel" ? "Fuel station" : p.kind === "services" ? "Truck services" : "Truck parking";
          pois[i] = {
            ...p,
            name: cityState ? `${kindLabel} · ${cityState}` : `${kindLabel} near this exit`,
            city: p.city ?? rev.city,
            state: p.state ?? rev.state,
          };
        } catch {
          const kindLabel =
            p.kind === "fuel" ? "Fuel station" : p.kind === "services" ? "Truck services" : "Truck parking";
          pois[i] = { ...p, name: kindLabel };
        }
      }),
    );
    cache[key] = { ts: Date.now(), pois };
    saveCache(cache);
    return pois;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function milestoneStop(center: GeoPoint, mileMark: number): POI {
  return {
    id: `mile-${mileMark}`,
    name: `Mile ${mileMark}`,
    lat: center.lat,
    lng: center.lng,
    kind: "milestone",
  };
}

/**
 * Reverse-geocode a lat/lng so we can show "Effingham, IL" instead of "Mile 1"
 * when Overpass returns no truck-friendly POIs nearby.
 */
export async function locatedMilestone(center: GeoPoint, mileMark: number): Promise<POI> {
  const rev = await reverseGeocode({ lat: center.lat, lng: center.lng });
  const name = [rev.city, rev.state].filter(Boolean).join(", ") || `Stop ${mileMark}`;
  return {
    id: `mile-${center.lat.toFixed(2)},${center.lng.toFixed(2)}`,
    name,
    lat: center.lat,
    lng: center.lng,
    kind: "milestone",
    city: rev.city,
    state: rev.state,
  };
}
