import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-teal text-white hover:bg-brand-teal/90 active:bg-brand-teal/80 shadow-card",
        coral: "bg-brand-coral text-white hover:bg-brand-coral/90 active:bg-brand-coral/80 shadow-card",
        outline: "border border-slate-200 bg-white text-ink hover:bg-slate-50",
        ghost: "text-ink hover:bg-slate-100",
        subtle: "bg-brand-mint/60 text-brand-teal hover:bg-brand-mint",
        destructive: "bg-brand-coral text-white hover:bg-brand-coral/90",
      },
      size: {
        default: "h-12 px-4 text-sm",
        lg: "h-14 px-5 text-base",
        sm: "h-10 px-3 text-sm",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
