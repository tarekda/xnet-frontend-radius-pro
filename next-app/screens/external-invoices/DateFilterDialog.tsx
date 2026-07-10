import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftDateRange: DateRange | undefined;
  onDraftDateRangeChange: (range: DateRange | undefined) => void;
  currentFrom: string | null;
  currentTo: string | null;
  /** Applies a from/to range (both YYYY-MM-DD) and resets search + page. */
  onApplyRange: (from: string, to: string) => void;
  onClearDates: () => void;
  /** Quick preset filter keys: today / last7d / last30d. */
  onQuickPreset: (filter: string) => void;
};

export const DateFilterDialog = ({
  open,
  onOpenChange,
  draftDateRange,
  onDraftDateRangeChange,
  currentFrom,
  currentTo,
  onApplyRange,
  onClearDates,
  onQuickPreset,
}: Props) => {
  const applyPreset = (filter: string) => {
    onQuickPreset(filter);
    onDraftDateRangeChange(undefined);
    onOpenChange(false);
  };

  const monthValue = (() => {
    if (!currentFrom || !currentTo) return "";
    try {
      const y = parseInt(currentFrom.slice(0, 4), 10);
      const m = parseInt(currentFrom.slice(5, 7), 10);
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(y, m, 0).toISOString().slice(0, 10);
      if (currentFrom === first && currentTo === last) return currentFrom.slice(0, 7);
    } catch {}
    return "";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Date filter</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DateRangePicker
            className="w-full"
            dateRange={draftDateRange}
            onDateRangeChange={(range) => {
              // Important: keep a local draft so users can pick "from" then "to"
              // without the picker snapping back to the URL-controlled value.
              onDraftDateRangeChange(range);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset("today")}>
              Today
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset("last7d")}>
              Last 7 Days
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset("last30d")}>
              Last 30 Days
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Month</span>
            <Input
              type="month"
              className="w-[160px]"
              value={monthValue}
              onChange={(e) => {
                const val = e.target.value; // YYYY-MM
                if (!val) {
                  onClearDates();
                  return;
                }
                const [yy, mm] = val.split("-").map((x) => parseInt(x, 10));
                if (!yy || !mm) return;
                const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
                const to = new Date(yy, mm, 0).toISOString().slice(0, 10);
                onApplyRange(from, to);
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClearDates();
              onDraftDateRangeChange(undefined);
            }}
          >
            Clear dates
          </Button>
          <Button
            onClick={() => {
              if (draftDateRange?.from && draftDateRange?.to) {
                onApplyRange(
                  draftDateRange.from.toISOString().slice(0, 10),
                  draftDateRange.to.toISOString().slice(0, 10)
                );
              }
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
