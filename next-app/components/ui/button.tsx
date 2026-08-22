import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary via-indigo-600 to-primary bg-[length:200%_100%] text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110",
        destructive: "bg-destructive text-white shadow-md shadow-destructive/20 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30 focus-visible:ring-destructive/25",
        outline: "border border-border/80 bg-card/80 backdrop-blur-xs text-foreground shadow-xs hover:border-primary/40 hover:bg-secondary/70 hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary/80",
        ghost: "hover:bg-secondary/80 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9.5 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8.5 gap-1.5 rounded-lg px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-2xl px-6 text-base has-[>svg]:px-5",
        icon: "size-9.5 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ✅ Wrap Button with forwardRef to allow refs
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref} // ✅ Attach ref here
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

// ✅ Ensure a display name for debugging
Button.displayName = "Button";

export { Button, buttonVariants };
