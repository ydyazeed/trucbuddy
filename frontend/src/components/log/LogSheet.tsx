import { Fragment } from "react";
import type { DailyLogModel } from "@/hos/types";
import { cn } from "@/lib/utils";

const ROW_LABELS: Record<string, { label: string; color: string }> = {
  off_duty: { label: "Off Duty", color: "#94A3B8" },
  sleeper: { label: "Sleeper Berth", color: "#C8DCD4" },
  driving: { label: "Driving", color: "#2A7268" },
  on_duty: { label: "On Duty (not driving)", color: "#E5574E" },
};

const W = 1440;
const H = 240;
const ROW_H = H / 4;
const LEFT_GUTTER = 160;
const RIGHT_GUTTER = 90;
const SVG_W = LEFT_GUTTER + W + RIGHT_GUTTER;

interface Props {
  log: DailyLogModel;
  className?: string;
}

export function LogSheet({ log, className }: Props) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-3", className)}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${H}`}
          role="img"
          aria-label={`Daily log for ${log.log_date}`}
          className="block min-w-[720px] w-full"
        >
        {/* Background grid */}
        <rect x={LEFT_GUTTER} y={0} width={W} height={H} fill="#F8FAFC" />
        {/* Hour grid lines */}
        {Array.from({ length: 25 }).map((_, hr) => (
          <line
            key={`v-${hr}`}
            x1={LEFT_GUTTER + (hr * W) / 24}
            x2={LEFT_GUTTER + (hr * W) / 24}
            y1={0}
            y2={H}
            stroke={hr === 0 || hr === 24 ? "#94A3B8" : hr % 6 === 0 ? "#CBD5E1" : "#E2E8F0"}
            strokeWidth={1}
          />
        ))}
        {/* Quarter-hour minor ticks at top of each row */}
        {log.rows.map((_, rowIdx) =>
          Array.from({ length: 96 }).map((_, q) => {
            const x = LEFT_GUTTER + (q * W) / 96;
            const y = rowIdx * ROW_H;
            return (
              <line
                key={`q-${rowIdx}-${q}`}
                x1={x}
                x2={x}
                y1={y}
                y2={y + 6}
                stroke="#94A3B8"
                strokeWidth={0.5}
              />
            );
          }),
        )}
        {/* Row separators + labels + totals */}
        {log.rows.map((row, idx) => {
          const y = idx * ROW_H;
          const meta = ROW_LABELS[row.status];
          return (
            <Fragment key={row.status}>
              <line x1={LEFT_GUTTER} x2={LEFT_GUTTER + W} y1={y} y2={y} stroke="#94A3B8" strokeWidth={1} />
              <text
                x={LEFT_GUTTER - 12}
                y={y + ROW_H / 2 + 5}
                textAnchor="end"
                fontSize={14}
                fontWeight={600}
                fill="#0F172A"
              >
                {meta.label}
              </text>
              <text
                x={LEFT_GUTTER + W + 12}
                y={y + ROW_H / 2 + 5}
                fontSize={14}
                fontWeight={700}
                fill={meta.color}
              >
                {(row.totalMinutes / 60).toFixed(2)}h
              </text>
            </Fragment>
          );
        })}
        <line x1={LEFT_GUTTER} x2={LEFT_GUTTER + W} y1={H} y2={H} stroke="#94A3B8" strokeWidth={1} />
        {/* Status period bars */}
        {log.rows.map((row, rowIdx) => {
          const meta = ROW_LABELS[row.status];
          const yMid = rowIdx * ROW_H + ROW_H / 2;
          return row.segments.map((seg, segIdx) => {
            const x1 = LEFT_GUTTER + seg.startMin;
            const x2 = LEFT_GUTTER + seg.endMin;
            return (
              <Fragment key={`s-${rowIdx}-${segIdx}`}>
                <line x1={x1} x2={x2} y1={yMid} y2={yMid} stroke={meta.color} strokeWidth={6} strokeLinecap="round" />
              </Fragment>
            );
          });
        })}
        {/* Hour numbers */}
        {Array.from({ length: 25 }).map((_, hr) => (
          <text
            key={`hr-${hr}`}
            x={LEFT_GUTTER + (hr * W) / 24}
            y={-4}
            textAnchor="middle"
            fontSize={10}
            fill="#475569"
          >
            {hr}
          </text>
        ))}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {(["off_duty", "sleeper", "driving", "on_duty"] as const).map(s => (
          <div key={s} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="font-medium text-ink-subtle">{ROW_LABELS[s].label}</span>
            <span className="tabnums font-bold" style={{ color: ROW_LABELS[s].color }}>
              {(log.totals[s] / 60).toFixed(2)}h
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Visual snap to 15-min cells; row totals reflect true durations. Daily total: {(log.totalMinutes / 60).toFixed(2)}h.
      </p>
    </div>
  );
}
