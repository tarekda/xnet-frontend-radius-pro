import React from "react";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

type Props = {
  isLoading: boolean;
  error?: unknown;
  /** If true, renders empty fallback instead of children */
  isEmpty?: boolean;
  /** Skeleton type to show when loading. Default: "table" */
  skeletonType?: "table" | "card" | "custom";
  /** Optional retry handler (shown on error) */
  onRetry?: () => void;
  /** Custom loading UI */
  loading?: React.ReactNode;
  /** Custom empty UI */
  empty?: React.ReactNode;
  /** Custom error UI */
  errorFallback?: React.ReactNode;
  /** Used if errorFallback is not provided */
  errorTitle?: string;
  /** Used if empty is not provided */
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
};

function errorToMessage(error: unknown): string {
  if (!error) return "Unknown error occurred";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "Unknown error";
  try {
    const anyErr = error as any;
    return (
      anyErr?.response?.data?.message ||
      anyErr?.data?.message ||
      anyErr?.message ||
      JSON.stringify(error)
    );
  } catch {
    return "Unknown error occurred";
  }
}

export default function QueryState({
  isLoading,
  error,
  isEmpty,
  skeletonType = "table",
  onRetry,
  loading,
  empty,
  errorFallback,
  errorTitle = "Something went wrong",
  emptyTitle = "No results",
  emptyDescription = "Try adjusting filters or search terms.",
  children,
}: Props) {
  if (isLoading) {
    if (loading) return <>{loading}</>;

    if (skeletonType === "table") {
      return <TableSkeleton />;
    }

    return (
      <div className="space-y-3 rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    );
  }

  if (error) {
    if (errorFallback) return <>{errorFallback}</>;
    return (
      <div className="space-y-3">
        <Alert type="error" message={`${errorTitle}: ${errorToMessage(error)}`} />
        {onRetry ? (
          <div>
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <>
        {empty ?? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={onRetry ? "Refresh" : undefined}
            onAction={onRetry}
          />
        )}
      </>
    );
  }

  return <>{children}</>;
}

