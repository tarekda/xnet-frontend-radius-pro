import React, { useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Sparkles, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCurrentMonthDateRange,
  getRelativeMonthDateRange,
  getMonthDateRange,
  formatBillingMonthLabel,
  type MonthRange,
} from "@/lib/externalInvoiceDateUtils";

type Props = {
  currentFrom?: string;
  currentTo?: string;
  onSelectMonthRange: (from: string, to: string) => void;
  onSelectAllTime: () => void;
  className?: string;
};

export const BillingMonthSelector: React.FC<Props> = ({
  currentFrom,
  currentTo,
  onSelectMonthRange,
  onSelectAllTime,
  className = "",
}) => {
  const currentMonthRange = useMemo(() => getCurrentMonthDateRange(), []);
  const activeLabel = useMemo(
    () => formatBillingMonthLabel(currentFrom, currentTo),
    [currentFrom, currentTo]
  );

  const isCurrentMonthActive =
    currentFrom === currentMonthRange.from && currentTo === currentMonthRange.to;
  const isAllTimeActive = !currentFrom && !currentTo;

  // Determine reference month for step navigation (defaulting to current month if unselected)
  const activeYearMonth = useMemo(() => {
    if (currentFrom && currentFrom.length >= 7) {
      const [y, m] = currentFrom.split("-").map((x) => parseInt(x, 10));
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
    return { year: currentMonthRange.year, month: currentMonthRange.month };
  }, [currentFrom, currentMonthRange]);

  const handleStepMonth = (delta: number) => {
    let newMonth = activeYearMonth.month + delta;
    let newYear = activeYearMonth.year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const range = getMonthDateRange(newYear, newMonth);
    onSelectMonthRange(range.from, range.to);
  };

  // Generate recent 18 months options for the dropdown list
  const monthOptions = useMemo(() => {
    const list: MonthRange[] = [];
    const now = new Date();
    // 12 months back, 3 months forward
    for (let offset = -12; offset <= 3; offset++) {
      list.push(getRelativeMonthDateRange(offset, now));
    }
    return list.reverse(); // Newest first
  }, []);

  return (
    <div
      className={`relative flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/80 p-2 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-primary/40 ${className}`}
    >
      {/* Active Month Label / Icon Pill */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Billing Month
        </span>
        <Badge
          variant={isCurrentMonthActive ? "default" : "secondary"}
          className={`font-semibold text-xs transition-all ${
            isCurrentMonthActive
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
              : "bg-muted text-foreground"
          }`}
        >
          {activeLabel}
        </Badge>
      </div>

      {/* Steppers & Quick Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-all duration-150 active:scale-95"
          title="Previous Month"
          onClick={() => handleStepMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant={isCurrentMonthActive ? "default" : "outline"}
          size="sm"
          className={`h-8 gap-1.5 px-3 text-xs font-medium transition-all duration-150 ${
            isCurrentMonthActive
              ? "shadow-sm shadow-primary/20"
              : "hover:bg-primary/10 hover:text-primary"
          }`}
          onClick={() => onSelectMonthRange(currentMonthRange.from, currentMonthRange.to)}
        >
          <Calendar className="h-3.5 w-3.5" />
          Current Month
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-all duration-150 active:scale-95"
          title="Next Month"
          onClick={() => handleStepMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Dropdown Month Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-3 text-xs font-medium hover:border-primary/40 hover:bg-accent"
          >
            Select Month
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Choose Billing Period
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {monthOptions.map((opt) => {
            const isSelected = currentFrom === opt.from && currentTo === opt.to;
            return (
              <DropdownMenuItem
                key={opt.from}
                className={`flex items-center justify-between text-xs cursor-pointer ${
                  isSelected ? "font-semibold text-primary bg-primary/10" : ""
                }`}
                onClick={() => onSelectMonthRange(opt.from, opt.to)}
              >
                <span>{opt.monthName} {opt.year}</span>
                {opt.isCurrentMonth && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/40 text-primary">
                    Now
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* All Time Pill */}
      <Button
        variant={isAllTimeActive ? "secondary" : "ghost"}
        size="sm"
        className={`h-8 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground ${
          isAllTimeActive ? "bg-muted text-foreground font-semibold" : ""
        }`}
        onClick={onSelectAllTime}
      >
        <Globe className="h-3.5 w-3.5" />
        All Time
      </Button>
    </div>
  );
};

export default React.memo(BillingMonthSelector);
