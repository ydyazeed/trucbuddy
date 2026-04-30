import { classifyZone } from "@/hos/rules";
import { cn } from "@/lib/utils";

interface Props {
  remainingMin: number;
  totalMin: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}

const ZONE_COLOR: Record<string, string> = {
  green: "#2A7268",
  amber: "#F59E0B",
  red: "#E5574E",
};

function fmt(min: number): string {
  const m = Math.max(0, min);
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  const ss = Math.floor((m * 60) % 60);
  if (h > 0) return `${h}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function CountdownRing({ remainingMin, totalMin, size = 72, stroke = 6, className, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = totalMin > 0 ? Math.min(1, Math.max(0, 1 - remainingMin / totalMin)) : 0;
  const offset = c * (1 - fraction);
  const zone = classifyZone(remainingMin);
  const color = ZONE_COLOR[zone];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="tabnums text-sm font-extrabold" style={{ color }}>
              {fmt(remainingMin)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
