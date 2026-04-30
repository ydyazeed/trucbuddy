import type { GeoPoint } from "@/hos/types";

const ENDPOINT = "https://photon.komoot.io/api";
const REVERSE = "https://photon.komoot.io/reverse";

export interface PhotonHit {
  label: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
}

export async function searchPlaces(query: string, limit = 6, signal?: AbortSignal): Promise<PhotonHit[]> {
  if (!query || query.length < 2) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const data = await res.json();
  return (data.features ?? []).map((f: any): PhotonHit => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties ?? {};
    const city = props.city || props.town || props.village || props.county;
    const state = props.state || props.statecode;
    const country = props.country;
    const parts = [props.name, city, state, country].filter(Boolean);
    return {
      label: parts.join(", "),
      lat,
      lng,
      city,
      state,
      country,
    };
  });
}

const REVERSE_CACHE_KEY = "truc_reverse_cache";
function loadCache(): Record<string, { city: string; state: string }> {
  try {
    const raw = localStorage.getItem(REVERSE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCache(c: Record<string, { city: string; state: string }>) {
  try {
    localStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore quota
  }
}

export async function reverseGeocode(point: { lat: number; lng: number }): Promise<{ city: string; state: string }> {
  const key = `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
  const cache = loadCache();
  if (cache[key]) return cache[key];
  const url = `${REVERSE}?lat=${point.lat}&lon=${point.lng}&lang=en`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Reverse ${res.status}`);
    const data = await res.json();
    const props = data.features?.[0]?.properties ?? {};
    const out = {
      city: props.city || props.town || props.village || props.county || "Unknown",
      state: props.state || "",
    };
    cache[key] = out;
    saveCache(cache);
    return out;
  } catch {
    return { city: "Unknown", state: "" };
  }
}

export function toGeoPoint(hit: PhotonHit): GeoPoint {
  return { lat: hit.lat, lng: hit.lng, label: hit.label };
}
