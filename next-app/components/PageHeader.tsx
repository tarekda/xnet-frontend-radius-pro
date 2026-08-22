import React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
  /** Default: "card" */
  variant?: "card" | "gradient";
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  rightContent,
  className,
  variant = "card",
}) => {
  const isGradient = variant === "gradient";

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/80 p-4 shadow-[var(--shop-shadow)] transition-all duration-300 sm:p-5",
        isGradient
          ? "overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/50 to-background text-foreground backdrop-blur-md"
          : "bg-card/95 backdrop-blur-md",
        className
      )}
    >
      {isGradient ? (
        <>
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary to-indigo-600" />
          <div className="absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -left-12 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
        </>
      ) : null}

      <div className={cn("relative", isGradient && "z-10")}>
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3.5 min-w-0">
            {Icon ? (
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 hover:scale-105",
                  isGradient
                    ? "border-primary/25 bg-primary/15 text-primary"
                    : "border-primary/15 bg-secondary text-primary"
                )}
              >
                <Icon className="h-5 w-5 text-primary" />
              </div>
            ) : null}

            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {(rightContent || actions) ? (
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
              {rightContent ? <div className="w-full md:w-auto">{rightContent}</div> : null}
              {actions ? (
                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
                  {actions}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;


