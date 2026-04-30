import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlaceField } from "@/components/trip/PlaceField";
import { fetchRoute, toRoutePlan } from "@/routing/ors";
import { runEngine } from "@/hos/engine";
import { useCreateTrip } from "@/api/trips";
import type { PhotonHit } from "@/geocode/photon";

export function NewTripPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<PhotonHit | null>(null);
  const [pickup, setPickup] = useState<PhotonHit | null>(null);
  const [dropoff, setDropoff] = useState<PhotonHit | null>(null);
  const [cycleHours, setCycleHours] = useState("0");
  const [planning, setPlanning] = useState(false);
  const create = useCreateTrip();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !pickup || !dropoff) {
      toast.error("Please fill in all three locations.");
      return;
    }
    const cycleNum = Number(cycleHours);
    if (Number.isNaN(cycleNum) || cycleNum < 0 || cycleNum > 70) {
      toast.error("Cycle hours must be a number from 0 to 70.");
      return;
    }
    if (pickup.label === dropoff.label) {
      const ok = window.confirm("Pickup and dropoff are the same. Continue?");
      if (!ok) return;
    }

    setPlanning(true);
    try {
      const route = await fetchRoute(
        { lat: current.lat, lng: current.lng, label: current.label },
        { lat: pickup.lat, lng: pickup.lng, label: pickup.label },
        { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.label },
      );
      const plan = runEngine({
        trip: {
          current: { lat: current.lat, lng: current.lng, label: current.label },
          pickup: { lat: pickup.lat, lng: pickup.lng, label: pickup.label },
          dropoff: { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.label },
          cycleHoursUsed: cycleNum,
        },
        route: toRoutePlan(route),
        events: [],
        preferences: { stopStrategy: "auto", avgSpeedMph: 55 },
        now: new Date().toISOString(),
      });

      const logsForBackend = plan.dailyLogs.map(log => ({
        log_date: log.log_date,
        log_data: log,
      }));

      const created = await create.mutateAsync({
        inputs: {
          current: { label: current.label, lat: current.lat, lng: current.lng },
          pickup: { label: pickup.label, lat: pickup.lat, lng: pickup.lng },
          dropoff: { label: dropoff.label, lat: dropoff.lat, lng: dropoff.lng },
          cycle_hours: cycleNum,
        },
        plan: {
          schedule: plan.schedule,
          dailyLogs: plan.dailyLogs,
          distanceMi: plan.totals.distanceMi,
          durationHr: plan.totals.driveMin / 60,
          feasibility: plan.feasibility,
          upcoming: plan.upcoming,
          routeGeometry: route.legs.map(l => l.geometry),
        } as any,
        status: "planned",
        // logs are added via TripCreateSerializer via included `logs` payload below
        ...({ logs: logsForBackend } as any),
      });
      toast.success("Trip planned.");
      navigate(`/trips/${created.id}/map`);
    } catch (err) {
      console.error(err);
      toast.error("Could not plan trip. Check your inputs and connection.");
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal">New trip</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Plan a route</h1>
        <p className="text-sm text-ink-subtle">
          Property-carrying driver · 70hr/8day cycle · auto-fueling every 1,000 mi · 1h pickup &amp; dropoff.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Trip inputs</CardTitle>
          <CardDescription>
            We'll plan a truck-aware route with HOS-compliant stops and one daily log per calendar day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <PlaceField label="Current location" value={current} onChange={setCurrent} required />
            <PlaceField label="Pickup location" value={pickup} onChange={setPickup} required />
            <PlaceField label="Dropoff location" value={dropoff} onChange={setDropoff} required />
            <div className="space-y-1">
              <label htmlFor="cycle" className="block text-sm font-semibold text-ink">
                Current cycle used (hrs)
                <span className="text-brand-coral"> *</span>
              </label>
              <Input
                id="cycle"
                inputMode="decimal"
                type="number"
                min={0}
                max={70}
                step="0.1"
                value={cycleHours}
                onChange={e => setCycleHours(e.target.value)}
              />
              <p className="text-xs text-ink-faint">
                0–70. We assume the hours are evenly distributed across the past 8 days.
              </p>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={planning}>
              {planning && <Loader2 className="h-5 w-5 animate-spin" />}
              {planning ? "Planning…" : "Plan trip"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
