import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type Props = {
  /** 1-based */
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isDisabled?: boolean;
  noun?: string; // "results" | "items" | "users"
};

export default function TablePager({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100, 200, 500],
  onPageChange,
  onPageSizeChange,
  isDisabled,
  noun = "results",
}: Props) {
  const safeTotalPages = Math.max(1, Number.isFinite(totalPages) ? totalPages : 1);
  const safePage = Math.min(Math.max(1, currentPage || 1), safeTotalPages);

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {onPageSizeChange ? (
          <div className="flex items-center gap-1">
            <Label htmlFor="pageSize" className="text-sm">
              Show:
            </Label>
            <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue defaultValue={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <span className="text-sm text-muted-foreground">
          Showing {from} to {to} of {totalItems} {noun}
        </span>
      </div>

      <nav className="flex items-center space-x-2" aria-label="Pagination">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={safePage === 1 || isDisabled}
          className="hidden sm:flex"
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1 || isDisabled}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 sm:mr-2" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex items-center gap-1 text-sm font-medium" aria-live="polite">
          Page {safePage} of {safeTotalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === safeTotalPages || isDisabled}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 sm:ml-2" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safePage === safeTotalPages || isDisabled}
          className="hidden sm:flex"
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}

