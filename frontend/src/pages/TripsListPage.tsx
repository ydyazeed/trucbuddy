import { Link } from "react-router-dom";
import { Loader2, Truck } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTrips } from "@/api/trips";
import { ThreeDots } from "@/components/ui/three-dots";

const STATUS_TONE = {
  planned: "mint",
  active: "teal",
  completed: "neutral",
} as const;

export function TripsListPage() {
  const { data, isLoading, isError, refetch } = useTrips();

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal">Your trips</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Plan, track, log.</h1>
        </div>
        <Button variant="primary" asChild>
          <Link to="/trips/new">New trip</Link>
        </Button>
      </header>

      <p className="text-xs text-ink-faint">
        Trips are private to this device. Clearing site data will remove access — note your trip URLs if you need to come back.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10 text-ink-subtle">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="font-semibold text-ink">Couldn't reach the server.</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : data && data.length > 0 ? (
        <ul className="space-y-3">
          {data.map(t => (
            <li key={t.id}>
              <Link
                to={`/trips/${t.id}/map`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-teal/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-ink">
                    {t.inputs.pickup.label} <span className="text-ink-subtle">→</span> {t.inputs.dropoff.label}
                  </p>
                  <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-subtle">
                  {Math.round(t.plan?.distanceMi ?? 0)} mi · cycle used {t.inputs.cycle_hours}h ·{" "}
                  {format(new Date(t.created_at), "MMM d, HH:mm")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThreeDots /> Welcome aboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-sm text-ink-subtle">
              <Truck className="h-4 w-4" /> No trips yet. Plan one to see a truck-aware route, HOS-compliant stops, and drawn ELD logs.
            </p>
            <Button asChild className="mt-4 w-full" size="lg">
              <Link to="/trips/new">Plan your first trip</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
