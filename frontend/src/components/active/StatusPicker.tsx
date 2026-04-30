import { useState } from "react";
import { toast } from "sonner";
import { Truck, BedDouble, Coffee, Briefcase } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DutyStatus, HOSClocks } from "@/hos/types";
import { cn, uuid } from "@/lib/utils";
import { useAppendEvent } from "@/api/trips";
import { useActiveTrip } from "@/store/active";

const OPTIONS: { value: DutyStatus; label: string; Icon: typeof Truck; color: string }[] = [
  { value: "driving", label: "Driving", Icon: Truck, color: "bg-brand-teal text-white" },
  { value: "on_duty", label: "On duty (not driving)", Icon: Briefcase, color: "bg-brand-coral text-white" },
  { value: "off_duty", label: "Off duty", Icon: Coffee, color: "bg-slate-200 text-ink" },
  { value: "sleeper", label: "Sleeper berth", Icon: BedDouble, color: "bg-brand-mint text-brand-teal" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  current: DutyStatus;
  clocks: HOSClocks;
}

export function StatusPicker({ open, onOpenChange, tripId, current, clocks }: Props) {
  const append = useAppendEvent(tripId);
  const setStatus = useActiveTrip(s => s.setStatus);
  const setLoc = useActiveTrip(s => s.setLocation);
  const [busy, setBusy] = useState<DutyStatus | null>(null);

  const choose = async (next: DutyStatus) => {
    if (next === "driving") {
      if (clocks.drive11 <= 0) {
        toast.error("Drive limit reached. Take 10h off-duty first.");
        return;
      }
      if (clocks.window14 <= 0) {
        toast.error("14-hour window exceeded. Take 10h off-duty first.");
        return;
      }
      if (clocks.sinceBreak8 <= 0) {
        toast.error("30-minute break required before more driving.");
        return;
      }
      if (clocks.cycle70 <= 0) {
        toast.error("70/8 cycle exhausted. 34-hour restart required.");
        return;
      }
    }
    setBusy(next);
    const at = new Date().toISOString();
    let coords: { lat: number; lng: number } | null = null;
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => {
              if (pos.coords.accuracy > 100) resolve(null);
              else resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
          );
        });
      } catch {
        coords = null;
      }
    }
    try {
      await append.mutateAsync({
        event_type: "status_change",
        client_event_id: uuid(),
        occurred_at: at,
        payload: { status: next, previous: current, location: coords },
      });
      setStatus(next, at);
      if (coords) setLoc(coords.lat, coords.lng, at);
      toast.success(`Status: ${next.replace("_", " ")}`);
      onOpenChange(false);
    } catch {
      toast.error("Could not record status change.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change duty status</DialogTitle>
          <DialogDescription>
            Live HOS clocks update with every change. GPS is captured if available.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          {OPTIONS.map(o => (
            <Button
              key={o.value}
              variant="outline"
              className={cn("h-16 justify-start text-base", current === o.value && "border-brand-teal ring-2 ring-brand-teal/40")}
              onClick={() => choose(o.value)}
              disabled={busy !== null}
            >
              <span className={cn("mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full", o.color)}>
                <o.Icon className="h-4 w-4" />
              </span>
              <span className="font-semibold">{o.label}</span>
              {current === o.value && <span className="ml-auto text-xs text-brand-teal">current</span>}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
