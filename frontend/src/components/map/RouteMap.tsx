import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

import type { TimelineEntry, GeoPoint } from "@/hos/types";

const DEFAULT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const stopColor: Record<string, string> = {
  pickup: "#2A7268",
  dropoff: "#E5574E",
  fuel: "#0EA5E9",
  break30: "#F59E0B",
  rest10: "#6366F1",
  restart34: "#8B5CF6",
};

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    popupAnchor: [0, -32],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:30px;height:30px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${label}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-2px;"></div>
      </div>
    `,
  });
}

interface Props {
  current: GeoPoint;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  routeGeometry?: [number, number][][];
  schedule: TimelineEntry[];
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function RouteMap({ current, pickup, dropoff, routeGeometry, schedule }: Props) {
  const points: [number, number][] = useMemo(() => {
    if (routeGeometry && routeGeometry.length > 0) {
      return routeGeometry.flat();
    }
    return [
      [current.lat, current.lng],
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ];
  }, [current, dropoff, pickup, routeGeometry]);

  const stopMarkers = schedule.filter(s => ["fuel", "break30", "rest10", "restart34"].includes(s.category));

  return (
    <div className="relative h-[55vh] overflow-hidden rounded-2xl border border-slate-200 shadow-card">
      <MapContainer
        center={[current.lat, current.lng]}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url={DEFAULT_TILES}
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {routeGeometry?.map((leg, i) => (
          <Polyline
            key={i}
            positions={leg as L.LatLngExpression[]}
            pathOptions={{ color: i === 0 ? "#94A3B8" : "#2A7268", weight: 5, opacity: 0.85 }}
          />
        ))}
        <Marker position={[current.lat, current.lng]} icon={pinIcon("#0F172A", "1")}>
          <Popup>Current location · {current.label}</Popup>
        </Marker>
        <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon("#2A7268", "P")}>
          <Popup>Pickup · {pickup.label}</Popup>
        </Marker>
        <Marker position={[dropoff.lat, dropoff.lng]} icon={pinIcon("#E5574E", "D")}>
          <Popup>Dropoff · {dropoff.label}</Popup>
        </Marker>
        {stopMarkers.map((s, i) => (
          <Marker
            key={`stop-${i}`}
            position={[s.location.lat, s.location.lng]}
            icon={pinIcon(stopColor[s.category] ?? "#475569", String(i + 1))}
          >
            <Popup>
              {s.category} · {s.location.label}
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
