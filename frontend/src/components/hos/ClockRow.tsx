import { classifyZone } from "@/hos/rules";
import type { HOSClocks } from "@/hos/types";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  green: "bg-brand-mint text-brand-teal",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-brand-coral/15 text-brand-coral",
};

interface Props {
  clocks: HOSClocks;
}

const LABELS: { key: keyof HOSClocks; label: string }[] = [
  { key: "drive11", label: "Drive 11h" },
  { key: "window14", label: "Window 14h" },
  { key: "sinceBreak8", label: "Until break" },
  { key: "cycle70", label: "Cycle 70h" },
];

function formatRemaining(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function ClockRow({ clocks }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {LABELS.map(({ key, label }) => {
        const remaining = clocks[key];
        const zone = classifyZone(remaining);
        return (
          <div
            key={key}
            className={cn("rounded-2xl px-3 py-2 text-center font-semibold", TONES[zone])}
          >
            <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
            <p className="tabnums text-xl font-extrabold">{formatRemaining(remaining)}</p>
          </div>
        );
      })}
    </div>
  );
}
