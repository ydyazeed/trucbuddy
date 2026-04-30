import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Download } from "lucide-react";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogSheet } from "./LogSheet";
import { SignaturePad } from "./SignaturePad";
import { CorrectionsModal } from "./CorrectionsModal";
import { PrintableLog } from "./PrintableLog";
import { validateDailyLog } from "@/hos/logs";
import type { DailyLogModel } from "@/hos/types";
import { usePatchLog, useSignLog, type DailyLogDTO } from "@/api/trips";
import { Badge } from "@/components/ui/badge";

interface Props {
  tripId: string;
  log: DailyLogDTO;
  liveModel?: DailyLogModel;
}

export function LogEditor({ tripId, log, liveModel }: Props) {
  const [fieldOverrides, setFieldOverrides] = useState<DailyLogModel["fields"]>(log.log_data.fields);
  const draft: DailyLogModel = useMemo(() => {
    if (log.signed || !liveModel) {
      return { ...log.log_data, fields: { ...log.log_data.fields, ...fieldOverrides } };
    }
    return { ...liveModel, fields: { ...liveModel.fields, ...log.log_data.fields, ...fieldOverrides } };
  }, [log.signed, log.log_data, liveModel, fieldOverrides]);
  const [showSign, setShowSign] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const patchMutation = usePatchLog(tripId);
  const signMutation = useSignLog(tripId);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `trucbuddy-log-${log.log_date}`,
  });

  // Pulse a "Just updated" badge when the underlying log_data changes (e.g. after
  // a stop swap re-derives the schedule and PATCHes this log).
  const dataKey = useMemo(
    () => JSON.stringify(log.log_data.rows.map(r => [r.totalMinutes, r.segments.map(s => [s.startMin, s.endMin])])),
    [log.log_data.rows],
  );
  const prevKeyRef = useRef(dataKey);
  const [updatedAt, setUpdatedAt] = useState(0);
  useEffect(() => {
    if (prevKeyRef.current !== dataKey) {
      prevKeyRef.current = dataKey;
      setUpdatedAt(Date.now());
    }
  }, [dataKey]);
  useEffect(() => {
    if (updatedAt === 0) return;
    const id = setTimeout(() => setUpdatedAt(0), 5000);
    return () => clearTimeout(id);
  }, [updatedAt]);
  const justUpdated = updatedAt > 0;

  const handleFieldChange = (field: keyof DailyLogModel["fields"], value: string) => {
    setFieldOverrides(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const v = validateDailyLog(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    try {
      await patchMutation.mutateAsync({ date: log.log_date, log_data: draft });
      toast.success("Log saved.");
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err?.status === 409) {
        toast.error("Log is signed; switch to corrections.");
      } else {
        toast.error("Could not save log.");
      }
    }
  };

  const handleSign = async (dataUrl: string) => {
    try {
      await signMutation.mutateAsync({ date: log.log_date, signature_image: dataUrl });
      toast.success("Log signed.");
      setShowSign(false);
      try {
        localStorage.setItem("truc_signature", dataUrl);
      } catch {
        // ignore
      }
    } catch {
      toast.error("Could not sign log.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-subtle">Daily log</p>
          <h2 className="text-2xl font-extrabold tracking-tight">{log.log_date}</h2>
        </div>
        <div className="flex items-center gap-2">
          {justUpdated && (
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-brand-mint px-2.5 py-1 text-xs font-bold text-brand-teal">
              <Sparkles className="h-3 w-3" /> Updated
            </span>
          )}
          {log.signed ? <Badge tone="teal">Signed</Badge> : <Badge tone="amber">Unsigned</Badge>}
        </div>
      </div>
      <LogSheet log={draft} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Truck or tractor number"
          placeholder="Truck / tractor #"
          value={draft.fields.truck_number ?? ""}
          onChange={e => handleFieldChange("truck_number", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Trailer number"
          placeholder="Trailer #"
          value={draft.fields.trailer_number ?? ""}
          onChange={e => handleFieldChange("trailer_number", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Carrier name"
          placeholder="Carrier name"
          value={draft.fields.carrier_name ?? ""}
          onChange={e => handleFieldChange("carrier_name", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Carrier address"
          placeholder="Carrier address"
          value={draft.fields.carrier_address ?? ""}
          onChange={e => handleFieldChange("carrier_address", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Co-driver name"
          placeholder="Co-driver name (optional)"
          value={draft.fields.co_driver ?? ""}
          onChange={e => handleFieldChange("co_driver", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Shipper name"
          placeholder="Shipper name"
          value={draft.fields.shipper ?? ""}
          onChange={e => handleFieldChange("shipper", e.target.value)}
          disabled={log.signed}
        />
        <Input
          aria-label="Shipping document number"
          placeholder="Shipping doc #"
          value={draft.fields.shipping_doc ?? ""}
          onChange={e => handleFieldChange("shipping_doc", e.target.value)}
          disabled={log.signed}
        />
      </div>

      {!log.signed && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={handleSave} disabled={patchMutation.isPending}>
            Save changes
          </Button>
          <Button variant="primary" onClick={() => setShowSign(true)}>
            Sign log
          </Button>
        </div>
      )}

      {log.signed && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-subtle">
            Signed at {new Date(log.signed_at!).toLocaleString()}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => handlePrint()}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="coral" onClick={() => setShowCorrections(true)}>
              Make a correction
            </Button>
          </div>
        </div>
      )}

      {log.signed && log.corrections.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Corrections audit trail</h3>
          <ul className="mt-2 divide-y divide-slate-200">
            {log.corrections.map(c => (
              <li key={c.client_event_id} className="py-2 text-sm">
                <p className="font-semibold text-ink">{c.field_path}</p>
                <p className="text-ink-subtle">
                  <span className="line-through">{JSON.stringify(c.original_value)}</span>{" "}
                  → <span className="font-semibold">{JSON.stringify(c.corrected_value)}</span>
                </p>
                <p className="text-xs text-ink-faint">{c.reason} · {new Date(c.timestamp).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SignaturePad open={showSign} onOpenChange={setShowSign} onSubmit={handleSign} />
      <CorrectionsModal
        open={showCorrections}
        onOpenChange={setShowCorrections}
        tripId={tripId}
        log={log}
      />
      <div style={{ position: "absolute", left: -10000, top: 0, width: 1100 }} aria-hidden>
        <PrintableLog
          ref={printRef}
          log={draft}
          signatureImage={log.signature_image}
          corrections={log.corrections}
        />
      </div>
    </div>
  );
}
