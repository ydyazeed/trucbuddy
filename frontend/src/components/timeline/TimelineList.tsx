import { useState } from "react";
import { format } from "date-fns";
import {
  Truck,
  Coffee,
  Fuel,
  PackageCheck,
  PackagePlus,
  BedDouble,
  RotateCw,
  Briefcase,
  ChevronDown,
  Loader2,
} from "lucide-react";

import type { TimelineEntry } from "@/hos/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { POI } from "@/poi/overpass";
import { useStopOptions, type RequiredStop } from "./useStopOptions";

const ICONS = {
  drive: Truck,
  pickup: PackagePlus,
  dropoff: PackageCheck,
  fuel: Fuel,
  break30: Coffee,
  rest10: BedDouble,
  restart34: RotateCw,
  on_duty: Briefcase,
} as const;

const COLORS: Record<string, string> = {
  drive: "bg-brand-teal",
  pickup: "bg-brand-teal",
  dropoff: "bg-brand-coral",
  fuel: "bg-sky-500",
  break30: "bg-amber-500",
  rest10: "bg-indigo-500",
  restart34: "bg-violet-500",
  on_duty: "bg-brand-coral",
};

const STOP_CATEGORIES = new Set(["fuel", "break30", "rest10", "restart34"]);

interface Props {
  schedule: TimelineEntry[];
  emphasizeIndex?: number;
  onSelectStop?: (scheduleIndex: number, poi: POI) => void | Promise<void>;
  busyScheduleIndex?: number | null;
}

export function TimelineList({ schedule, emphasizeIndex, onSelectStop, busyScheduleIndex }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { required, pois, loading } = useStopOptions(schedule, expanded);
  const stopByScheduleIndex = new Map(required.map(r => [r.scheduleIndex, r] as const));

  return (
    <ol className="space-y-3">
      {schedule.map((entry, idx) => {
        const Icon = ICONS[entry.category];
        const tone = COLORS[entry.category] ?? "bg-slate-500";
        const minutes = (new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 60000;
        const isCurrent = emphasizeIndex === idx;
        const stop = stopByScheduleIndex.get(idx);
        const isStop = STOP_CATEGORIES.has(entry.category);
        const open = expanded === idx;
        const optionList = stop ? pois[String(stop.uiIndex)] : undefined;
        const items = optionList?.items ?? [];
        const hasAlternatives = optionList?.hasAlternatives ?? false;
        const isSwapped = optionList?.isSwapped ?? false;

        return (
          <li
            key={`${entry.start}-${idx}`}
            className={cn(
              "rounded-2xl border bg-white shadow-card",
              isCurrent ? "border-brand-teal ring-2 ring-brand-teal/30" : "border-slate-200",
            )}
          >
            <div className="flex items-start gap-4 p-4">
              <span
                className={cn(
                  "mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                  tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold capitalize text-ink">{entry.category.replace("_", " ")}</p>
                  <div className="text-right">
                    <p className="tabnums text-sm text-ink-subtle">
                      {format(new Date(entry.start), "HH:mm")} → {format(new Date(entry.end), "HH:mm")}
                    </p>
                    <p className="tabnums text-xs text-ink-faint">
                      {format(new Date(entry.start), "EEE, MMM d")}
                      {format(new Date(entry.start), "yyyy-MM-dd") !==
                        format(new Date(entry.end), "yyyy-MM-dd") &&
                        ` → ${format(new Date(entry.end), "EEE, MMM d")}`}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink-subtle">
                  {entry.location.label} · {Math.round(minutes)} min
                  {entry.distance_mi > 0 ? ` · ${Math.round(entry.distance_mi)} mi` : ""}
                </p>
                {entry.remark && <p className="mt-1 text-xs text-ink-faint">{entry.remark}</p>}
                {stop && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="mint">Mile {Math.round(stop.cumulativeMi)}</Badge>
                    <Badge tone="neutral">ETA {format(new Date(entry.start), "HH:mm")}</Badge>
                    {entry.auto_location &&
                      (Math.abs(entry.auto_location.lat - entry.location.lat) > 1e-5 ||
                        Math.abs(entry.auto_location.lng - entry.location.lng) > 1e-5) && (
                        <Badge tone="amber">Custom</Badge>
                      )}
                    {onSelectStop && (
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : idx)}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-brand-teal/40 px-3 py-1 text-xs font-semibold text-brand-teal hover:bg-brand-teal/5"
                      >
                        {open ? "Hide options" : "Change stop"}
                        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isStop && open && stop && (
              <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                {loading ? (
                  <p className="flex items-center gap-2 text-sm text-ink-subtle">
                    <Loader2 className="h-4 w-4 animate-spin" /> Looking up nearby truck-friendly stops…
                  </p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-ink-subtle">
                    No other options nearby — sticking with the auto-picked stop.
                  </p>
                ) : (
                  <>
                    {!hasAlternatives && isSwapped && (
                      <p className="mb-2 text-xs text-ink-faint">
                        No truck-friendly alternatives nearby. You can revert to the auto-picked stop:
                      </p>
                    )}
                    <ul className="space-y-2">
                      {items.map(p => {
                        const blocked = p.outsideHos === true;
                        return (
                          <li
                            key={p.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border bg-white p-3",
                              blocked ? "border-brand-coral/40 opacity-70" : "border-slate-200",
                            )}
                          >
                            <div>
                              <p className="font-semibold text-ink">{p.name}</p>
                              <p className="text-xs text-ink-faint">
                                {p.kind}
                                {p.city || p.state
                                  ? ` · ${[p.city, p.state].filter(Boolean).join(", ")}`
                                  : ""}
                                {p.distanceFromOriginMi !== undefined && (
                                  <> · {Math.round(p.distanceFromOriginMi)} mi from previous</>
                                )}
                              </p>
                              {blocked && (
                                <p className="mt-1 text-xs font-semibold text-brand-coral">
                                  Outside the legal HOS window for this stop.
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyScheduleIndex === idx || blocked}
                              onClick={async () => {
                                if (blocked) return;
                                await onSelectStop?.(idx, p);
                                setExpanded(null);
                              }}
                            >
                              {busyScheduleIndex === idx ? "Saving…" : "Choose"}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type { RequiredStop };
