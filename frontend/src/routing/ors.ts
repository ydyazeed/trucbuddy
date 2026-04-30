import type { GeoPoint, RoutePlan } from "@/hos/types";

const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson";

interface RouteSegment {
  distance_mi: number;
  duration_hr: number;
  geometry: [number, number][];
}

export interface FetchedRoute {
  legs: RouteSegment[];
  totalDistanceMi: number;
  totalDurationHr: number;
}

const METERS_PER_MILE = 1609.344;

async function callORS(coords: [number, number][]): Promise<RouteSegment> {
  const key = import.meta.env.VITE_ORS_API_KEY;
  if (!key) {
    return fallbackRoute(coords);
  }
  try {
    const res = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: key,
      },
      body: JSON.stringify({ coordinates: coords, units: "mi" }),
    });
    if (!res.ok) throw new Error(`ORS ${res.status}`);
    const data = await res.json();
    const feature = data.features?.[0];
    const summary = feature?.properties?.summary ?? feature?.properties?.segments?.[0];
    const distance = (summary?.distance ?? 0);
    const duration = (summary?.duration ?? 0) / 3600;
    const distanceMi = data.metadata?.query?.units === "mi" ? distance : distance / METERS_PER_MILE;
    const geometry: [number, number][] = (feature?.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]]);
    return {
      distance_mi: distanceMi,
      duration_hr: duration,
      geometry,
    };
  } catch (err) {
    console.warn("ORS failed, using haversine fallback", err);
    return fallbackRoute(coords);
  }
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const lat1 = toRad(latA);
  const lat2 = toRad(latB);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fallbackRoute(coords: [number, number][]): RouteSegment {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMiles(coords[i - 1], coords[i]);
  // 1.18 multiplier accounts for road-vs-crow-flight distance.
  const adjusted = total * 1.18;
  const geometry: [number, number][] = coords.map(c => [c[1], c[0]]);
  return {
    distance_mi: adjusted,
    duration_hr: adjusted / 55,
    geometry,
  };
}

export async function fetchRoute(current: GeoPoint, pickup: GeoPoint, dropoff: GeoPoint): Promise<FetchedRoute> {
  const sameStart = haversineMiles([current.lng, current.lat], [pickup.lng, pickup.lat]) < 1;
  const legs: RouteSegment[] = [];
  if (!sameStart) {
    legs.push(await callORS([[current.lng, current.lat], [pickup.lng, pickup.lat]]));
  } else {
    legs.push({ distance_mi: 0, duration_hr: 0, geometry: [[current.lat, current.lng]] });
  }
  legs.push(await callORS([[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]]));
  return {
    legs,
    totalDistanceMi: legs.reduce((s, l) => s + l.distance_mi, 0),
    totalDurationHr: legs.reduce((s, l) => s + l.duration_hr, 0),
  };
}

export function toRoutePlan(route: FetchedRoute): RoutePlan {
  return { legs: route.legs.map(l => ({ distance_mi: l.distance_mi, duration_hr: l.duration_hr, geometry: l.geometry })) };
}
