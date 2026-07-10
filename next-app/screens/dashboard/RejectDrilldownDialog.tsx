import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/api/client";

type AuthFailureRow = {
  id: number;
  timestamp: string;
  username: string | null;
  nasIp: string | null;
  macAddress: string | null;
  status: string | null;
};

type Props = {
  /** Hour bucket selected on the reject-rate trend chart ("YYYY-MM-DD HH:00"), or null when closed. */
  selectedRejectBucket: string | null;
  onClose: () => void;
};

/** Drilldown dialog listing failed auth attempts for the hour selected on the reject-rate trend. */
const RejectDrilldownDialog: React.FC<Props> = ({ selectedRejectBucket, onClose }) => {
  const selectedRange = useMemo(() => {
    if (!selectedRejectBucket) return null;
    const from = new Date(String(selectedRejectBucket).replace(" ", "T"));
    if (!Number.isFinite(from.getTime())) return null;
    const to = new Date(from.getTime() + 60 * 60 * 1000);
    return { from, to };
  }, [selectedRejectBucket]);

  const authFailuresPageHref = useMemo(() => {
    if (!selectedRange) return "/auth-failures";
    const params = new URLSearchParams({
      from: selectedRange.from.toISOString().slice(0, 16),
      to: selectedRange.to.toISOString().slice(0, 16),
    });
    return `/auth-failures?${params.toString()}`;
  }, [selectedRange]);

  const authFailuresQuery = useQuery({
    queryKey: ["auth-failures", selectedRejectBucket],
    queryFn: async () => {
      if (!selectedRange) return { rows: [] as AuthFailureRow[] };
      const resp = await apiClient.get("/auth-failures", {
        params: {
          from: selectedRange.from.toISOString(),
          to: selectedRange.to.toISOString(),
          limit: 300,
        },
      });
      return (resp?.data?.data ?? { rows: [] }) as { rows: AuthFailureRow[] };
    },
    enabled: Boolean(selectedRange),
  });

  return (
    <Dialog open={Boolean(selectedRejectBucket)} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle>
              Failed Auth Attempts
              {selectedRange ? ` (${selectedRange.from.toLocaleString()} - ${selectedRange.to.toLocaleTimeString()})` : ""}
            </DialogTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={authFailuresPageHref}>Open full page</Link>
            </Button>
          </div>
        </DialogHeader>
        {authFailuresQuery.isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !authFailuresQuery.data?.rows?.length ? (
          <div className="text-sm text-muted-foreground">No failed auth rows found for this hour.</div>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">NAS</th>
                  <th className="px-3 py-2">MAC</th>
                </tr>
              </thead>
              <tbody>
                {authFailuresQuery.data.rows.map((r) => (
                  <tr key={String(r.id)} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">{r.username || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="destructive">{r.status || "failed"}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.nasIp || "-"}</td>
                    <td className="px-3 py-2">{r.macAddress || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RejectDrilldownDialog;
