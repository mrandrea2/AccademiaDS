import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700",
        outline:
          "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
        ghost: "text-slate-700 hover:bg-slate-100",
        destructive: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        default: "px-5 py-3 text-base",
        sm: "px-3 py-2 text-sm",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
