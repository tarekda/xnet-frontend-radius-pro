import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  isScanning: boolean;
  flaggedCount: number;
  avgDaysOverdue: number;
  overdueAmount: number;
};

export const ReconciliationBanner = ({ isScanning, flaggedCount, avgDaysOverdue, overdueAmount }: Props) => (
  <Card className="overflow-hidden border-amber-200/70 bg-amber-50/50 shadow-none dark:border-amber-900/40 dark:bg-amber-950/20">
    <CardContent className="flex flex-wrap items-center gap-3 p-3">
      <Badge variant="outline" className="border-amber-300 bg-amber-100/80 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        Reconciliation mode
      </Badge>
      {isScanning ? (
        <Badge variant="outline" className="text-xs">Scanning all filtered invoices…</Badge>
      ) : (
        <span className="text-sm text-muted-foreground">{flaggedCount} flagged invoice{flaggedCount === 1 ? "" : "s"}</span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-border/70 bg-background/80 px-2.5 py-1">
          Avg overdue <strong className="ml-1">{avgDaysOverdue.toFixed(1)}d</strong>
        </span>
        <span className="rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Overdue <strong className="ml-1">${overdueAmount.toLocaleString()}</strong>
        </span>
      </div>
    </CardContent>
  </Card>
);
