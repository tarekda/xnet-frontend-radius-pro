import { useMemo, useState } from "react";
import QueryState from "@/components/QueryState";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TablePager from "@/components/TablePager";
import { useUserSessions } from "@/hooks/useUserSessions";

function formatBytes(b: string | number | null | undefined) {
  const n = typeof b === "number" ? b : parseInt(String(b ?? "0"), 10);
  if (!Number.isFinite(n) || n <= 0) return "0 Bytes";
  const k = 1024;
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / k ** i).toFixed(2)} ${units[i]}`;
}

function formatUptime(s: number | null | undefined) {
  const sec = Number(s ?? 0);
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, r && `${r}s`].filter(Boolean).join(" ");
}

export default function UserSessionsPanel(props: { username: string }) {
  const username = String(props.username ?? "").trim();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const query = useUserSessions(username, page, limit);
  const rows = query.data?.data?.sessions ?? [];
  const totalPages = query.data?.data?.totalPages ?? 1;
  const totalItems = query.data?.data?.totalSessions ?? 0;

  const pageSizes = useMemo(() => [10, 25, 50, 100, 200], []);

  return (
    <QueryState
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!query.isLoading && !query.error && rows.length === 0}
      onRetry={() => query.refetch()}
      errorTitle="Failed to load user sessions"
      emptyTitle="No sessions found"
      emptyDescription="This user has no accounting sessions yet."
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden overflow-auto max-h-[70vh] md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/95 shadow-sm backdrop-blur-sm dark:bg-card/90">
                <TableRow>
                  <TableHead className="w-[220px]">Session ID</TableHead>
                  <TableHead className="w-[200px]">Start</TableHead>
                  <TableHead className="w-[200px]">Stop</TableHead>
                  <TableHead className="w-[120px]">Total time</TableHead>
                  <TableHead className="w-[160px]">Download</TableHead>
                  <TableHead className="w-[160px]">Upload</TableHead>
                  <TableHead className="w-[160px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.session_id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{r.session_id}</TableCell>
                    <TableCell>{r.start_time ? new Date(r.start_time).toLocaleString() : "—"}</TableCell>
                    <TableCell>{r.stop_time ? new Date(r.stop_time).toLocaleString() : "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatUptime(r.session_time)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatBytes(r.bytes_out)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatBytes(r.bytes_in)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatBytes(r.total_bytes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {rows.map((r) => (
              <div key={r.session_id} className="space-y-2 rounded-lg border border-border/60 p-4">
                <div className="break-all font-mono text-xs">{r.session_id}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Start</div>
                    <div>{r.start_time ? new Date(r.start_time).toLocaleString() : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total time</div>
                    <div className="font-mono text-sm">{formatUptime(r.session_time)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-mono text-sm">{formatBytes(r.total_bytes)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Download</div>
                    <div className="font-mono text-sm">{formatBytes(r.bytes_out)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Upload</div>
                    <div className="font-mono text-sm">{formatBytes(r.bytes_in)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TablePager
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={limit}
        pageSizeOptions={pageSizes}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setLimit(s);
          setPage(1);
        }}
        isDisabled={query.isLoading}
        noun="sessions"
      />
    </QueryState>
  );
}

