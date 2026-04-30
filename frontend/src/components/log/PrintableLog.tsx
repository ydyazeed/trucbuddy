import { Fragment, forwardRef } from "react";

import type { DailyLogModel } from "@/hos/types";
import type { DailyLogDTO } from "@/api/trips";

const ROW_LABELS: Record<string, { label: string; color: string }> = {
  off_duty: { label: "Off Duty", color: "#0F172A" },
  sleeper: { label: "Sleeper Berth", color: "#0F172A" },
  driving: { label: "Driving", color: "#0F172A" },
  on_duty: { label: "On Duty (not driving)", color: "#0F172A" },
};

const W = 1440;
const H = 240;
const ROW_H = H / 4;
const LEFT_GUTTER = 170;
const RIGHT_GUTTER = 90;
const SVG_W = LEFT_GUTTER + W + RIGHT_GUTTER;
const REMARKS_BAND_H = 28;
const REMARKS_LABEL_AREA = 110;

const STATUS_ROW: Record<string, number> = {
  off_duty: 0,
  sleeper: 1,
  driving: 2,
  on_duty: 3,
};

interface Props {
  log: DailyLogModel;
  signatureImage: string | null;
  corrections: DailyLogDTO["corrections"];
}

function formatDate(iso: string): { month: string; day: string; year: string } {
  const [y, m, d] = iso.split("-");
  return { month: m, day: d, year: y };
}

function correctedSegmentMinutes(corrections: DailyLogDTO["corrections"]): Set<number> {
  const out = new Set<number>();
  for (const c of corrections) {
    if (typeof c.field_path !== "string") continue;
    const m = c.field_path.match(/rows\.\d+\.segments\.(\d+)/);
    if (m) out.add(Number(m[1]));
  }
  return out;
}

export const PrintableLog = forwardRef<HTMLDivElement, Props>(function PrintableLog(
  { log, signatureImage, corrections },
  ref,
) {
  const { month, day, year } = formatDate(log.log_date);
  const f = log.fields;

  return (
    <div ref={ref} className="printable-log">
      <style>{`
        @page { size: letter landscape; margin: 0.4in; }
        @media print {
          body * { visibility: hidden; }
          .printable-log, .printable-log * { visibility: visible; }
          .printable-log { position: absolute; left: 0; top: 0; width: 100%; }
        }
        .printable-log {
          font-family: 'Sora', system-ui, -apple-system, sans-serif;
          color: #0F172A;
          background: #ffffff;
          padding: 12px 16px;
          font-size: 11px;
          line-height: 1.25;
        }
        .printable-log .form-row { display: flex; align-items: flex-end; gap: 16px; }
        .printable-log .field { flex: 1; border-bottom: 1px solid #0F172A; min-height: 22px; padding: 0 4px 2px; font-weight: 500; }
        .printable-log .label { font-size: 9px; text-align: center; color: #334155; margin-top: 2px; }
        .printable-log .title { text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 0.04em; }
        .printable-log .subtitle { text-align: center; font-size: 9px; font-weight: 600; color: #334155; }
        .printable-log .certify { text-align: center; font-size: 9px; color: #334155; margin: 4px 0; }
        .printable-log .small-cap { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; color: #334155; }
        .printable-log .box {
          border: 1px solid #0F172A;
          padding: 8px 10px;
          min-height: 90px;
        }
        .printable-log .sig-img { max-height: 36px; max-width: 200px; }
        .printable-log .corrected-mark { fill: #E5574E; font-weight: 700; }
        .printable-log .footer-list { font-size: 10px; line-height: 1.45; margin: 0; padding-left: 14px; }
        .printable-log .corrections-block { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #94A3B8; font-size: 10px; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", alignItems: "end", gap: 16 }}>
        <div className="small-cap">U.S. DEPARTMENT OF TRANSPORTATION</div>
        <div>
          <div className="title">DRIVER&apos;S DAILY LOG</div>
          <div className="subtitle">(ONE CALENDAR DAY — 24 HOURS)</div>
        </div>
        <div />
      </div>

      <div className="form-row" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          <div className="field" style={{ width: 70 }}>{month}</div>
          <div className="field" style={{ width: 60 }}>{day}</div>
          <div className="field" style={{ width: 80 }}>{year}</div>
        </div>
        <div className="field" style={{ flex: 1, textAlign: "center" }}>
          {f.total_miles ?? 0}
        </div>
        <div className="field" style={{ flex: 1.2, textAlign: "center" }}>
          {[f.truck_number, f.trailer_number].filter(Boolean).join(" / ")}
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "space-between" }}>
          <div className="label" style={{ width: 70 }}>(MONTH)</div>
          <div className="label" style={{ width: 60 }}>(DAY)</div>
          <div className="label" style={{ width: 80 }}>(YEAR)</div>
        </div>
        <div className="label" style={{ flex: 1 }}>(TOTAL MILES DRIVING TODAY)</div>
        <div className="label" style={{ flex: 1.2 }}>VEHICLE NUMBERS — (SHOW EACH UNIT)</div>
      </div>

      <p className="certify">I certify that these entries are true and correct</p>

      <div className="form-row">
        <div className="field" style={{ flex: 1 }}>{f.carrier_name ?? ""}</div>
        <div className="field" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {signatureImage ? <img className="sig-img" src={signatureImage} alt="Driver signature" /> : null}
        </div>
      </div>
      <div className="form-row">
        <div className="label" style={{ flex: 1 }}>(NAME OF CARRIER OR CARRIERS)</div>
        <div className="label" style={{ flex: 1 }}>(DRIVER&apos;S SIGNATURE IN FULL)</div>
      </div>

      <div className="form-row" style={{ marginTop: 6 }}>
        <div className="field" style={{ flex: 1 }}>{f.carrier_address ?? ""}</div>
        <div className="field" style={{ flex: 1 }}>{f.co_driver ?? ""}</div>
      </div>
      <div className="form-row">
        <div className="label" style={{ flex: 1 }}>(MAIN OFFICE ADDRESS)</div>
        <div className="label" style={{ flex: 1 }}>(NAME OF CO-DRIVER)</div>
      </div>

      {/* Duty grid + remarks band */}
      <DutyGridSVG log={log} corrections={corrections} />

      {/* Bottom box: Pro/Shipping + remarks list + corrections */}
      <div className="box" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          <div style={{ flex: 1 }}>
            <span className="small-cap">Pro or Shipping No.</span>{" "}
            <span style={{ borderBottom: "1px solid #0F172A", padding: "0 32px" }}>
              {f.shipping_doc ?? ""}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <span className="small-cap">Shipper / Commodity</span>{" "}
            <span style={{ borderBottom: "1px solid #0F172A", padding: "0 32px" }}>
              {f.shipper ?? ""}
            </span>
          </div>
        </div>
        {log.remarks.length > 0 && (
          <ol className="footer-list" style={{ marginTop: 8 }}>
            {log.remarks.map((r, i) => (
              <li key={i}>
                {minToHHMM(r.atMin)} — {r.text}
              </li>
            ))}
          </ol>
        )}
        {corrections.length > 0 && (
          <div className="corrections-block">
            <div className="small-cap" style={{ color: "#E5574E" }}>✱ CORRECTIONS</div>
            <ul className="footer-list" style={{ paddingLeft: 14 }}>
              {corrections.map(c => (
                <li key={c.client_event_id}>
                  <strong>{c.field_path}</strong>:{" "}
                  <span style={{ textDecoration: "line-through" }}>
                    {JSON.stringify(c.original_value ?? null)}
                  </span>{" "}
                  → {JSON.stringify(c.corrected_value)} —{" "}
                  <em>{c.reason}</em> ({new Date(c.timestamp).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = Math.floor(min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

interface GridProps {
  log: DailyLogModel;
  corrections: DailyLogDTO["corrections"];
}

function DutyGridSVG({ log, corrections }: GridProps) {
  const correctedIdx = correctedSegmentMinutes(corrections);

  // Lay out remark labels with collision-aware vertical staggering.
  const sortedRemarks = [...log.remarks].sort((a, b) => a.atMin - b.atMin);
  const placements: { atMin: number; text: string; lane: number; idx: number }[] = [];
  const laneLastEnd = [0, 0, 0]; // 3 staggered lanes
  sortedRemarks.forEach((r, i) => {
    const lane = laneLastEnd.findIndex(end => r.atMin - end >= 25);
    const useLane = lane === -1 ? i % 3 : lane;
    placements.push({ atMin: r.atMin, text: r.text, lane: useLane, idx: i + 1 });
    laneLastEnd[useLane] = r.atMin;
  });

  const totalH = H + REMARKS_BAND_H + REMARKS_LABEL_AREA;
  const STATUS_ORDER = ["off_duty", "sleeper", "driving", "on_duty"] as const;

  return (
    <svg
      viewBox={`0 -16 ${SVG_W} ${totalH + 24}`}
      role="img"
      aria-label={`Daily log for ${log.log_date}`}
      style={{ width: "100%", display: "block", marginTop: 6 }}
    >
      {/* Outer border */}
      <rect x={LEFT_GUTTER} y={0} width={W} height={H} fill="#FFFFFF" stroke="#0F172A" strokeWidth={1} />

      {/* Hour vertical grid + numbers (top) */}
      {Array.from({ length: 25 }).map((_, hr) => {
        const x = LEFT_GUTTER + (hr * W) / 24;
        const labelText = hr === 0 || hr === 24 ? "Midnight" : hr === 12 ? "Noon" : String(hr);
        return (
          <Fragment key={`v-${hr}`}>
            <line
              x1={x}
              x2={x}
              y1={0}
              y2={H}
              stroke={hr === 0 || hr === 24 || hr === 12 ? "#0F172A" : hr % 3 === 0 ? "#475569" : "#94A3B8"}
              strokeWidth={hr === 0 || hr === 24 ? 1 : 0.5}
            />
            <text x={x} y={-4} textAnchor="middle" fontSize={9} fill="#0F172A">
              {labelText}
            </text>
          </Fragment>
        );
      })}

      {/* Quarter-hour ticks at top of each row */}
      {STATUS_ORDER.map((_, rowIdx) =>
        Array.from({ length: 96 }).map((__, q) => {
          const x = LEFT_GUTTER + (q * W) / 96;
          const y = rowIdx * ROW_H;
          return (
            <line
              key={`q-${rowIdx}-${q}`}
              x1={x}
              x2={x}
              y1={y}
              y2={y + (q % 4 === 0 ? 8 : 4)}
              stroke="#475569"
              strokeWidth={0.4}
            />
          );
        }),
      )}

      {/* Row separators + labels + totals */}
      {STATUS_ORDER.map((status, idx) => {
        const y = idx * ROW_H;
        const meta = ROW_LABELS[status];
        const total = log.totals[status];
        return (
          <Fragment key={status}>
            <line x1={LEFT_GUTTER} x2={LEFT_GUTTER + W} y1={y} y2={y} stroke="#0F172A" strokeWidth={0.5} />
            <text
              x={LEFT_GUTTER - 8}
              y={y + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fontWeight={600}
              fill={meta.color}
            >
              {meta.label}
            </text>
            <text
              x={LEFT_GUTTER + W + 8}
              y={y + ROW_H / 2 + 4}
              fontSize={11}
              fontWeight={700}
              fill={meta.color}
            >
              {(total / 60).toFixed(2)}
            </text>
          </Fragment>
        );
      })}

      {/* Status bars + transition connectors per row */}
      {STATUS_ORDER.map((status, rowIdx) => {
        const row = log.rows.find(r => r.status === status);
        if (!row) return null;
        const yMid = rowIdx * ROW_H + ROW_H / 2;
        return row.segments.map((seg, segIdx) => {
          const x1 = LEFT_GUTTER + seg.startMin;
          const x2 = LEFT_GUTTER + seg.endMin;
          const isCorrected = correctedIdx.has(segIdx);
          return (
            <Fragment key={`s-${rowIdx}-${segIdx}`}>
              <line
                x1={x1}
                x2={x2}
                y1={yMid}
                y2={yMid}
                stroke="#0F172A"
                strokeWidth={2.4}
                strokeLinecap="butt"
              />
              {isCorrected && (
                <text
                  x={x1 + (x2 - x1) / 2}
                  y={yMid - 6}
                  textAnchor="middle"
                  className="corrected-mark"
                  fontSize={11}
                >
                  ✱
                </text>
              )}
            </Fragment>
          );
        });
      })}

      {/* Vertical transition connectors between rows */}
      {transitionLines(log).map((t, i) => (
        <line
          key={`t-${i}`}
          x1={LEFT_GUTTER + t.atMin}
          x2={LEFT_GUTTER + t.atMin}
          y1={STATUS_ROW[t.from] * ROW_H + ROW_H / 2}
          y2={STATUS_ROW[t.to] * ROW_H + ROW_H / 2}
          stroke="#0F172A"
          strokeWidth={1.2}
        />
      ))}

      {/* Remarks band: hour ticks again */}
      <g transform={`translate(0, ${H + 4})`}>
        <text x={LEFT_GUTTER - 8} y={REMARKS_BAND_H / 2 + 4} textAnchor="end" fontSize={11} fontWeight={700}>
          REMARKS
        </text>
        <rect x={LEFT_GUTTER} y={0} width={W} height={REMARKS_BAND_H} fill="#FFFFFF" stroke="#0F172A" strokeWidth={0.5} />
        {Array.from({ length: 25 }).map((_, hr) => {
          const x = LEFT_GUTTER + (hr * W) / 24;
          const labelText = hr === 0 || hr === 24 ? "Midnight" : hr === 12 ? "Noon" : String(hr);
          return (
            <Fragment key={`rb-${hr}`}>
              <line x1={x} x2={x} y1={0} y2={REMARKS_BAND_H} stroke={hr % 3 === 0 ? "#475569" : "#94A3B8"} strokeWidth={0.5} />
              <text x={x} y={REMARKS_BAND_H + 10} textAnchor="middle" fontSize={8} fill="#334155">
                {labelText}
              </text>
            </Fragment>
          );
        })}
        {Array.from({ length: 96 }).map((_, q) => {
          const x = LEFT_GUTTER + (q * W) / 96;
          return <line key={`rq-${q}`} x1={x} x2={x} y1={0} y2={q % 4 === 0 ? 6 : 3} stroke="#475569" strokeWidth={0.4} />;
        })}

        {/* Remark labels: vertical guide line + rotated text */}
        {placements.map((p, i) => {
          const x = LEFT_GUTTER + p.atMin;
          const laneOffset = 14 + p.lane * 4;
          const labelY = REMARKS_BAND_H + laneOffset + 14;
          return (
            <g key={`rl-${i}`}>
              <line x1={x} x2={x} y1={REMARKS_BAND_H} y2={labelY - 2} stroke="#0F172A" strokeWidth={0.4} />
              <text
                x={x + 3}
                y={labelY}
                fontSize={8}
                fill="#0F172A"
                transform={`rotate(-60 ${x + 3} ${labelY})`}
              >
                {`${p.idx}. ${p.text}`}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function transitionLines(log: DailyLogModel): { atMin: number; from: keyof typeof STATUS_ROW; to: keyof typeof STATUS_ROW }[] {
  const events: { atMin: number; status: keyof typeof STATUS_ROW; kind: "start" | "end" }[] = [];
  for (const row of log.rows) {
    for (const seg of row.segments) {
      events.push({ atMin: seg.startMin, status: row.status as keyof typeof STATUS_ROW, kind: "start" });
      events.push({ atMin: seg.endMin, status: row.status as keyof typeof STATUS_ROW, kind: "end" });
    }
  }
  events.sort((a, b) => a.atMin - b.atMin || (a.kind === "end" ? -1 : 1));

  const transitions: { atMin: number; from: keyof typeof STATUS_ROW; to: keyof typeof STATUS_ROW }[] = [];
  let prevStatus: keyof typeof STATUS_ROW | null = null;
  for (const ev of events) {
    if (ev.kind === "start") {
      if (prevStatus && prevStatus !== ev.status) {
        transitions.push({ atMin: ev.atMin, from: prevStatus, to: ev.status });
      }
      prevStatus = ev.status;
    }
  }
  return transitions;
}
