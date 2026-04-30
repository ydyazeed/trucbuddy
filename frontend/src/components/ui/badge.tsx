import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "teal" | "coral" | "amber" | "mint";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-ink",
  teal: "bg-brand-teal text-white",
  coral: "bg-brand-coral text-white",
  amber: "bg-amber-500 text-white",
  mint: "bg-brand-mint text-brand-teal",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
