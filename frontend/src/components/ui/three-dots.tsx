import { cn } from "@/lib/utils";

export function ThreeDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-[3px]", className)}>
      <span className="h-2 w-2 rounded-full bg-brand-coral" />
      <span className="h-2 w-2 rounded-full bg-brand-teal" />
      <span className="h-2 w-2 rounded-full bg-brand-mint" />
    </span>
  );
}
