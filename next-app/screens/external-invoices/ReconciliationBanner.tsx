import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  isScanning: boolean;
  flaggedCount: number;
  avgDaysOverdue: number;
  overdueAmount: number;
};

export const ReconciliationBanner = ({ isScanning, flaggedCount, avgDaysOverdue, overdueAmount }: Props) => (
  <Card className="overflow-hidden border-orange-200/60 bg-gradient-to-r from-orange-50/80 to-amber-50/40 dark:border-orange-900/40 dark:from-orange-950/30 dark:to-amber-950/20">
    <CardContent className="flex flex-wrap items-center gap-3 p-4">
      <Badge variant="outline" className="border-orange-300 bg-orange-100/80 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200">
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
