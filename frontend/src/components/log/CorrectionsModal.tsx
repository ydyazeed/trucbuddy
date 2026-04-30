import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCorrectLog, type DailyLogDTO } from "@/api/trips";
import { uuid } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  log: DailyLogDTO;
}

const FIELD_OPTIONS = [
  { path: "fields.truck_number", label: "Truck / tractor #" },
  { path: "fields.trailer_number", label: "Trailer #" },
  { path: "fields.carrier_name", label: "Carrier name" },
  { path: "fields.carrier_address", label: "Carrier address" },
  { path: "fields.shipper", label: "Shipper" },
  { path: "fields.shipping_doc", label: "Shipping doc #" },
  { path: "remarks", label: "Remarks" },
];

function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<any>((cur, k) => (cur ? cur[k] : undefined), obj);
}

export function CorrectionsModal({ open, onOpenChange, tripId, log }: Props) {
  const [path, setPath] = useState(FIELD_OPTIONS[0].path);
  const [corrected, setCorrected] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useCorrectLog(tripId);

  const original = readPath(log.log_data, path);

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }
    try {
      await mutation.mutateAsync({
        date: log.log_date,
        field_path: path,
        original_value: original ?? null,
        corrected_value: corrected,
        reason: reason.trim(),
        client_event_id: uuid(),
      });
      toast.success("Correction recorded.");
      setCorrected("");
      setReason("");
      onOpenChange(false);
    } catch {
      toast.error("Could not record correction.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a correction</DialogTitle>
          <DialogDescription>This appends to the audit trail. Reason ≥ 10 characters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <label className="block text-sm font-semibold text-ink">
            Field
            <select
              className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={path}
              onChange={e => setPath(e.target.value)}
            >
              {FIELD_OPTIONS.map(o => (
                <option key={o.path} value={o.path}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-sm font-semibold text-ink">Original</p>
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-ink-subtle line-through">
              {original ? String(original) : "—"}
            </p>
          </div>
          <label className="block text-sm font-semibold text-ink">
            Corrected value
            <Input
              className="mt-1"
              value={corrected}
              onChange={e => setCorrected(e.target.value)}
              placeholder="New value"
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Reason (≥10 chars)
            <textarea
              className="mt-1 h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why are you correcting this?"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="coral" onClick={submit} disabled={mutation.isPending}>
              Record correction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
