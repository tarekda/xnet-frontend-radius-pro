import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** In-app route, e.g. `/users/list` */
  actionTo?: string;
  className?: string;
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/60 backdrop-blur-md px-6 py-12 text-center shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-md",
        className
      )}
      role="status"
      aria-label={title}
    >
      <div className="absolute -top-16 h-44 w-44 rounded-full bg-gradient-to-tr from-primary/15 via-indigo-500/15 to-purple-500/15 blur-3xl pointer-events-none" />
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-indigo-500/10 to-transparent text-primary shadow-sm ring-4 ring-primary/5 transition-transform duration-300 hover:scale-105">
          <Icon className="h-7 w-7 text-primary" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-base font-extrabold text-foreground tracking-tight">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">{description}</p> : null}
      {actionLabel && actionTo ? (
        <Button className="mt-6 rounded-xl font-semibold shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95" variant="default" asChild>
          <Link href={actionTo}>{actionLabel}</Link>
        </Button>
      ) : actionLabel && onAction ? (
        <Button className="mt-6 rounded-xl font-semibold shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95" variant="default" type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
