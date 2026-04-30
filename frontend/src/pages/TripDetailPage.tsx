import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppendEvent, useDeleteTrip, usePatchLog, useTrip, useUpdateTrip } from "@/api/trips";
import type { POI } from "@/poi/overpass";
import { RouteMap } from "@/components/map/RouteMap";
import { TimelineList } from "@/components/timeline/TimelineList";
import { LogEditor } from "@/components/log/LogEditor";
import { ClockRow } from "@/components/hos/ClockRow";
import { StatusPicker } from "@/components/active/StatusPicker";
import { useActiveTrip } from "@/store/active";
import type { DailyLogModel, EngineInputs, TimelineEntry } from "@/hos/types";
import { runEngine } from "@/hos/engine";
import { buildDailyLogs } from "@/hos/logs";
import { replayEvents } from "@/hos/replay";
import { swapStop } from "@/hos/swapStop";
import { liveUpcoming, useHosTicker } from "@/hos/ticker";
import { CountdownRing } from "@/components/hos/CountdownRing";
import { formatHours, useNow, uuid } from "@/lib/utils";

const TABS = ["map", "timeline", "logs"] as const;
type Tab = (typeof TABS)[number];

const FALLBACK_CLOCKS = { drive11: 660, window14: 840, cycle70: 4200, sinceBreak8: 480 };

export function TripDetailPage() {
  const params = useParams();
  const tripId = params.id!;
  const tab = (params.tab as Tab) ?? "map";
  const tabValid = TABS.includes(tab);

  const navigate = useNavigate();
  const { data: trip, isLoading } = useTrip(tripId);
  const update = useUpdateTrip(tripId);
  const append = useAppendEvent(tripId);
  const patchLog = usePatchLog(tripId);
  const deleteTrip = useDeleteTrip();
  const setActive = useActiveTrip(s => s.setActive);
  const setStoreStatus = useActiveTrip(s => s.setStatus);
  const currentStatus = useActiveTrip(s => s.currentStatus);
  const statusSince = useActiveTrip(s => s.statusSince);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyStopIndex, setBusyStopIndex] = useState<number | null>(null);
  const now = useNow(1000);

  useEffect(() => {
    if (trip?.status === "active") setActive(tripId);
    return () => setActive(null);
  }, [trip?.status, tripId, setActive]);

  const enginePlan = useMemo(() => {
    if (!trip) return null;
    const inputs: EngineInputs = {
      trip: {
        current: { ...trip.inputs.current, label: trip.inputs.current.label },
        pickup: { ...trip.inputs.pickup, label: trip.inputs.pickup.label },
        dropoff: { ...trip.inputs.dropoff, label: trip.inputs.dropoff.label },
        cycleHoursUsed: trip.inputs.cycle_hours,
      },
      route: {
        legs: [
          { distance_mi: 0, duration_hr: 0 },
          { distance_mi: 0, duration_hr: 0 },
        ],
      },
      events: (trip.events ?? []).map(e => ({ ...e, id: String(e.id) })),
      preferences: { stopStrategy: "auto", avgSpeedMph: 55 },
      now: trip.created_at,
    };
    return runEngine(inputs);
  }, [trip]);

  const planSchedule = useMemo<TimelineEntry[]>(
    () => (trip?.plan?.schedule as TimelineEntry[]) ?? enginePlan?.schedule ?? [],
    [trip?.plan, enginePlan],
  );
  const liveSchedule = useMemo(() => {
    if (!trip || trip.status !== "active") return planSchedule;
    return replayEvents({
      planned: planSchedule,
      events: (trip.events ?? []).map(e => ({ ...e, id: String(e.id) })),
      now: new Date(now).toISOString(),
      tripStart: trip.created_at,
    });
  }, [trip, planSchedule, now]);
  const liveLogsByDate = useMemo(() => {
    if (!trip || trip.status !== "active") return new Map<string, DailyLogModel>();
    const logs = buildDailyLogs(liveSchedule);
    return new Map(logs.map(l => [l.log_date, l] as const));
  }, [liveSchedule, trip]);
  const baseClocks = enginePlan?.hosClocks ?? FALLBACK_CLOCKS;
  const liveClocks = useHosTicker(baseClocks, currentStatus, statusSince, 1000, now);

  if (!tabValid) return <Navigate to={`/trips/${tripId}/map`} replace />;
  if (isLoading || !trip) {
    return (
      <div className="flex justify-center py-12 text-ink-subtle">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isActive = trip.status === "active";
  const clocks = isActive ? liveClocks : baseClocks;
  const upcoming = isActive ? liveUpcoming(liveClocks) : enginePlan?.upcoming ?? null;
  const routeGeom = (trip.plan as any)?.routeGeometry as [number, number][][] | undefined;

  const startTrip = async () => {
    try {
      await update.mutateAsync({ status: "active" });
      setStoreStatus("off_duty", new Date().toISOString());
      toast.success("Trip started.");
    } catch {
      toast.error("Could not start trip.");
    }
  };

  const handleStopChoose = async (stopIndex: number, poi: POI) => {
    if (!trip) return;
    const current = planSchedule[stopIndex]?.location;
    if (
      current &&
      Math.abs(current.lat - poi.lat) < 1e-5 &&
      Math.abs(current.lng - poi.lng) < 1e-5
    ) {
      toast.message("Already at this stop — nothing to update.");
      return;
    }
    setBusyStopIndex(stopIndex);
    const tripStart = trip.inputs.current;
    const newSchedule = swapStop(
      planSchedule,
      stopIndex,
      { lat: poi.lat, lng: poi.lng, label: poi.name },
      { lat: tripStart.lat, lng: tripStart.lng, label: tripStart.label },
    );
    const newDailyLogs = buildDailyLogs(newSchedule);
    const totalDistance = newSchedule
      .filter(e => e.category === "drive")
      .reduce((s, e) => s + e.distance_mi, 0);
    const totalDriveMin = newSchedule
      .filter(e => e.category === "drive")
      .reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60_000, 0);
    const newPlan = {
      ...(trip.plan as Record<string, unknown>),
      schedule: newSchedule,
      dailyLogs: newDailyLogs,
      distanceMi: totalDistance,
      durationHr: totalDriveMin / 60,
    };
    const existingLogs = trip.logs ?? [];

    try {
      await update.mutateAsync({ plan: newPlan as any });
    } catch {
      toast.error("Could not save stop choice.");
      setBusyStopIndex(null);
      return;
    }

    setBusyStopIndex(null);
    toast.success(`Stop set to ${poi.name}. Times and logs updating…`);

    void (async () => {
      try {
        const newLogsByDate = new Map(newDailyLogs.map(l => [l.log_date, l] as const));
        for (const log of existingLogs) {
          if (log.signed) continue;
          const next = newLogsByDate.get(log.log_date);
          if (!next) continue;
          await patchLog.mutateAsync({
            date: log.log_date,
            log_data: { ...next, fields: { ...next.fields, ...log.log_data.fields } },
          });
        }
        await append.mutateAsync({
          event_type: "replan",
          client_event_id: uuid(),
          occurred_at: new Date().toISOString(),
          payload: {
            reason: "stop_choice",
            stop_index: stopIndex,
            poi_id: poi.id,
            poi_name: poi.name,
          },
        });
      } catch {
        toast.error("Stop saved, but log/event sync failed. Refresh to retry.");
      }
    })();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this trip? Logs, events, and history will be removed.")) return;
    try {
      await deleteTrip.mutateAsync(tripId);
      toast.success("Trip deleted.");
      navigate("/trips", { replace: true });
    } catch {
      toast.error("Could not delete trip.");
    }
  };

  const completeTrip = async () => {
    if (!confirm("Mark this trip as completed? Unsigned logs remain visible.")) return;
    try {
      await update.mutateAsync({ status: "completed" });
      toast.success("Trip completed.");
    } catch {
      toast.error("Could not complete trip.");
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal">Trip</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {trip.inputs.pickup.label} → {trip.inputs.dropoff.label}
          </h1>
          <Badge tone={trip.status === "active" ? "teal" : trip.status === "planned" ? "mint" : "neutral"}>
            {trip.status}
          </Badge>
        </div>
        <p className="text-sm text-ink-subtle">
          {Math.round((trip.plan as any)?.distanceMi ?? 0)} mi · cycle used {trip.inputs.cycle_hours}h ·{" "}
          drive {(trip.plan as any)?.durationHr?.toFixed?.(1) ?? "—"}h
        </p>
      </header>

      {trip.status === "planned" && (
        <Button variant="primary" size="lg" className="w-full" onClick={startTrip}>
          Start trip
        </Button>
      )}

      {trip.status === "active" && (
        <Card>
          <CardHeader>
            <CardTitle>Active trip</CardTitle>
            <CardDescription>
              Live HOS clocks. Tap below to change duty status. GPS captured when you change status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClockRow clocks={clocks} />
            {upcoming && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-brand-mint/40 p-3 text-sm">
                {"minutesUntil" in upcoming ? (
                  <>
                    <CountdownRing
                      remainingMin={upcoming.minutesUntil}
                      totalMin={upcoming.totalMin}
                      size={64}
                      stroke={6}
                    />
                    <div>
                      <p className="font-semibold text-brand-teal">Next: {upcoming.reason}</p>
                      <p className="tabnums text-ink-subtle">
                        in {formatHours(upcoming.minutesUntil)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="font-semibold text-brand-teal">Next: {upcoming.reason}</p>
                    <p className="text-ink-subtle">
                      in {formatHours(upcoming.hoursUntil * 60)} · {upcoming.milesUntil} mi
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                Current: {currentStatus.replace("_", " ")}
              </Button>
              <Button variant="coral" onClick={completeTrip}>
                Complete trip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "map" && (
        <RouteMap
          current={{ ...trip.inputs.current }}
          pickup={{ ...trip.inputs.pickup }}
          dropoff={{ ...trip.inputs.dropoff }}
          routeGeometry={routeGeom}
          schedule={planSchedule}
        />
      )}

      {tab === "timeline" && (
        <div className="space-y-4">
          <TimelineList
            schedule={isActive ? liveSchedule : planSchedule}
            onSelectStop={handleStopChoose}
            busyScheduleIndex={busyStopIndex}
          />
          <Card>
            <CardHeader>
              <CardTitle>About this plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-ink-subtle">
              <p>Average speed: 55 mph · Pickup &amp; dropoff: 1 hour each</p>
              <p>Fueling assumed every 1,000 miles · 70/8 cycle</p>
              <p>
                Feasibility: <span className="font-semibold text-ink">{enginePlan?.feasibility}</span>
              </p>
            </CardContent>
          </Card>
          <Button variant="coral" onClick={handleDelete} className="w-full">
            <Trash2 className="h-4 w-4" /> Delete trip
          </Button>
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-6">
          {trip.logs && trip.logs.length > 0 ? (
            trip.logs.map(log => (
              <LogEditor
                key={log.log_date}
                tripId={tripId}
                log={log}
                liveModel={!log.signed ? liveLogsByDate.get(log.log_date) : undefined}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="font-semibold">No daily logs computed for this trip.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {trip.status === "active" && (
        <StatusPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          tripId={tripId}
          current={currentStatus}
          clocks={clocks}
        />
      )}
    </div>
  );
}
