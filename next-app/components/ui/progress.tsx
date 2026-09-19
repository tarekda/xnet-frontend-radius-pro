import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number
  showPercentage?: boolean
  text?: string
  indicatorClassName?: string
}

function Progress({
  className,
  indicatorClassName,
  value,
  showPercentage = false,
  text,
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2.5 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full transition-all duration-300",
          indicatorClassName ?? "bg-primary"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
      {(showPercentage || text) && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-primary-foreground mix-blend-difference">
          {text || `${Math.round(value || 0)}%`}
        </span>
      )}
    </ProgressPrimitive.Root>
  )
}

export { Progress }
