import React, { useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCollectorBreakdown, useCollectedInvoicesList, useCollectedMetrics } from '@/hooks/useInvoices';
import { useSearchParams } from "@/navigation/urlSearchParams";
import { Calendar, DollarSign, Users, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { reconcileCollectedInvoice, type CollectedInvoicesList, type CollectedMetrics, type CollectorBreakdown } from '@/api/invoices';
import { parseMysqlBool } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import TablePager from '@/components/TablePager';
import TableToolbar from '@/components/TableToolbar';
import TableRowActions from '@/components/TableRowActions';
import QueryState from '@/components/QueryState';
import { Skeleton } from '@/components/ui/skeleton';
import IconActionButton from "@/components/IconActionButton";
import { useTranslation } from "react-i18next";

function useCollectionsUrlQuery() {
  const [sp] = useSearchParams();
  return useMemo(() => new URLSearchParams(sp.toString()), [sp]);
}

const Collections: React.FC = () => {
  const { t } = useTranslation("screens");
  const params = useCollectionsUrlQuery();
  const view = params.get('view') || 'breakdown';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const dateFrom = range?.from ? range.from.toISOString().slice(0, 10) : undefined;
  const dateTo = range?.to ? range.to.toISOString().slice(0, 10) : undefined;

  const metricsQuery = useCollectedMetrics({ dateFrom, dateTo });
  const breakdownQuery = useCollectorBreakdown({ dateFrom, dateTo });
  const listQuery = useCollectedInvoicesList({ page, limit, dateFrom, dateTo });

  const metrics = metricsQuery.data as CollectedMetrics | undefined;
  const breakdown = breakdownQuery.data as CollectorBreakdown | undefined;
  const collectedList = listQuery.data as CollectedInvoicesList | undefined;

  const isLoading = metricsQuery.isLoading || breakdownQuery.isLoading || listQuery.isLoading;
  const error = metricsQuery.error || breakdownQuery.error || listQuery.error;

  const onReconcile = async (id: number) => {
    await reconcileCollectedInvoice(id);
    // refresh list and metrics
    listQuery.refetch();
    metricsQuery.refetch();
    breakdownQuery.refetch();
  };

  const canReconcile = (inv: CollectedInvoicesList['data'][number]) => {
    const pm = String(inv.paymentMethod ?? '').toLowerCase();
    const reconciled = parseMysqlBool(inv.cashReconciled);
    return pm === 'cash' && !reconciled;
  };

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("collections.title")}
        subtitle={t("collections.subtitle")}
        icon={DollarSign}
      />

      <QueryState
        isLoading={isLoading}
        error={error as any}
        isEmpty={
          !isLoading &&
          !error &&
          (view === 'breakdown'
            ? (breakdown?.length ?? 0) === 0
            : (collectedList?.data?.length ?? 0) === 0)
        }
        onRetry={() => {
          metricsQuery.refetch();
          breakdownQuery.refetch();
          listQuery.refetch();
        }}
        loading={
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader>
                  <Skeleton className="h-5 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-56" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        }
        errorTitle="Failed to load collections"
        emptyTitle="No collections found"
        emptyDescription="Try adjusting the date range or switching views."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Invoices Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalCollectedInvoices ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Cash Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(metrics?.totalCashCollected ?? 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="w-full min-w-0 sm:w-auto">
                  <DateRangePicker dateRange={range} onDateRangeChange={setRange} />
                </div>
                <IconActionButton
                  label="Clear date range"
                  variant="outline"
                  onClick={() => setRange(undefined)}
                  icon={<X className="h-4 w-4" />}
                />
                <IconActionButton
                  label="Today"
                  variant="outline"
                  onClick={() => {
                    const today = new Date();
                    setRange({ from: today, to: today });
                  }}
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {view === 'breakdown' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Per-Collector Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collector</TableHead>
                      <TableHead>Invoices</TableHead>
                      <TableHead>Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdown?.map((r) => (
                      <TableRow key={r.collector}>
                        <TableCell>{r.collector || '-'}</TableCell>
                        <TableCell>{r.count}</TableCell>
                        <TableCell>{r.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Collected Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <TableToolbar
                label={`Invoices: ${(collectedList?.total ?? 0).toLocaleString()} • Page ${page} / ${(collectedList?.totalPages ?? 1)} • Page total: ${(collectedList?.pageTotalAmount ?? 0).toFixed(2)}`}
              />
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Collected By</TableHead>
                        <TableHead>Collected At</TableHead>
                        <TableHead>Reconciled</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collectedList?.data?.map((inv: CollectedInvoicesList['data'][number]) => (
                        <TableRow key={inv.id}>
                          <TableCell>{inv.id}</TableCell>
                          <TableCell>{inv?.username ?? '-'}</TableCell>
                          <TableCell>{inv?.fullName ?? '-'}</TableCell>
                          <TableCell>{inv.amount?.toFixed(2)}</TableCell>
                          <TableCell>
                            {String(inv.paymentMethod ?? "").toLowerCase() === "wallet" ||
                            String((inv as any).paymentProvider ?? "").toLowerCase() === "wallet" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                  Own wallet
                                </span>
                                {(inv as any).paymentReference ? (
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {(inv as any).paymentReference}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              inv.paymentMethod ?? "-"
                            )}
                          </TableCell>
                          <TableCell>{inv.collectedBy ?? '-'}</TableCell>
                          <TableCell>{inv.collectedAt ? new Date(inv.collectedAt).toLocaleString() : '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {parseMysqlBool(inv.cashReconciled) ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  <span className="text-sm text-emerald-700">Yes</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-slate-400" />
                                  <span className="text-sm text-slate-600">No</span>
                                </>
                              )}
                              {inv.reconciledAt ? (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(inv.reconciledAt).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TableRowActions
                              actions={[
                                {
                                  label: 'Set Reconciled',
                                  onClick: () => onReconcile(inv.id),
                                  disabled: !canReconcile(inv),
                                },
                              ]}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <TablePager
                currentPage={page}
                totalPages={collectedList?.totalPages ?? 1}
                totalItems={collectedList?.total ?? 0}
                pageSize={limit}
                pageSizeOptions={[10, 20, 50, 100, 200]}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setLimit(n);
                  setPage(1);
                }}
                isDisabled={listQuery.isLoading}
                noun="invoices"
              />
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
};

export default Collections;


