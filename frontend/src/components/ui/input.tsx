import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-ink placeholder:text-ink-faint focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
