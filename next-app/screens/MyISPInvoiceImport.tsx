import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, CloudDownload, Database, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { notify } from '@/lib/notify';
import type { ImportPreviewData } from '@/lib/externalInvoiceImport';
import {
  useProviderImportPreview,
  useProviderInvoiceImport,
  type InvoiceImportSource,
} from '@/hooks/useMyISPInvoiceImport';
import type { InvoiceUploadResult } from '@/hooks/useInvoiceUpload';

function currentBillingMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const IMPORT_SOURCES: Array<{
  value: InvoiceImportSource;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { value: 'myisp', label: 'MyISP Account 1', description: 'Primary reseller page: selling price, plan, expiry, and customer details', icon: CloudDownload },
  { value: 'myisp2', label: 'MyISP Account 2', description: 'Second reseller page imported and reconciled independently', icon: CloudDownload },
  { value: 'idm', label: 'IDM', description: 'HSI Pro service, price, expiry date, and customer details', icon: CloudDownload },
  { value: 'terra', label: 'Terra', description: 'ACP Pro service, price, expiry date, and customer details', icon: CloudDownload },
  { value: 'radius', label: 'Active RADIUS users', description: 'Active accounts charged at their assigned profile price', icon: Database },
];

function requestErrorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  return error instanceof Error && error.message ? error.message : fallback;
}

function importSummary(stats?: InvoiceUploadResult): string {
  if (!stats) return 'Invoices imported successfully.';
  return `${stats.inserted} new, ${stats.updated} updated${
    stats.mergedDuplicates ? `, ${stats.mergedDuplicates} duplicate rows merged` : ''
  }${stats.removedFromScope ? `, ${stats.removedFromScope} removed from billing month` : ''}${
    stats.skippedRows ? `, ${stats.skippedRows} rows skipped` : ''
  }${stats.enrichedFromUserDetails ? `, ${stats.enrichedFromUserDetails} enriched from user profiles` : ''}${
    stats.inheritedPayDueDates ? `, ${stats.inheritedPayDueDates} pay due dates inherited` : ''
  }${stats.inheritedCarryoverLines ? `, ${stats.inheritedCarryoverLines} carryover lines added` : ''}.`;
}

export default function MyISPInvoiceImport() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<InvoiceImportSource>('myisp');
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth);
  const [autoPayDue, setAutoPayDue] = useState(false);
  const [payDueDayOffset, setPayDueDayOffset] = useState(15);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const previewMutation = useProviderImportPreview();
  const importMutation = useProviderInvoiceImport();
  const sourceLabel = IMPORT_SOURCES.find((item) => item.value === source)?.label ?? source;

  const fetchPreview = async () => {
    if (!billingMonth) {
      notify.error('Select billing month', 'Choose the invoice billing month before previewing.');
      return;
    }
    try {
      setLastImportSummary(null);
      const data = await previewMutation.mutateAsync({ source, billingMonth });
      setPreview(data);
      if (!data.validRowCount) {
        notify.error('No invoices ready', `${sourceLabel} returned no valid invoice rows for import.`);
      }
    } catch (error) {
      setPreview(null);
      notify.error(`${sourceLabel} preview failed`, requestErrorMessage(error, `Could not fetch users from ${sourceLabel}.`));
    }
  };

  const runImport = async () => {
    if (!preview?.validRowCount || !billingMonth) return;
    try {
      const result = await importMutation.mutateAsync({
        source,
        billingMonth,
        payDueDayOffset: autoPayDue ? payDueDayOffset : undefined,
      });
      const summary = importSummary(result.data);
      setLastImportSummary(summary);
      notify.success(`${sourceLabel} import complete`, summary);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['externalInvoices'] }),
        queryClient.invalidateQueries({ queryKey: ['externalInvoicesPaymentDue'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      ]);
      const refreshed = await previewMutation.mutateAsync({ source, billingMonth });
      setPreview(refreshed);
    } catch (error) {
      notify.error(`${sourceLabel} import failed`, requestErrorMessage(error, 'Could not import the previewed invoices.'));
    }
  };

  const isBusy = previewMutation.isPending || importMutation.isPending;

  return (
    <div className="w-full space-y-6 py-6">
      <PageHeader
        title="Automatic Invoice Import"
        subtitle="Preview provider or active RADIUS invoices, then import them safely into External Invoices"
        icon={CloudDownload}
      />

      <Card>
        <CardHeader>
          <CardTitle>Select invoice source</CardTitle>
          <CardDescription>
            Nothing is written until you review the preview and click Import. Each source is reconciled
            independently, so importing one provider cannot remove another provider&apos;s invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_SOURCES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setSource(item.value);
                    setPreview(null);
                    setLastImportSummary(null);
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    source === item.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="myisp-billing-month">Billing month</Label>
              <Input
                id="myisp-billing-month"
                type="month"
                value={billingMonth}
                disabled={isBusy}
                onChange={(event) => {
                  setBillingMonth(event.target.value);
                  setPreview(null);
                  setLastImportSummary(null);
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Pay due on import</Label>
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="text-muted-foreground">
                  {source === 'radius'
                    ? 'A RADIUS user’s expiry date is used as payment due. Without an expiry, the current month’s inherited/default due date is used.'
                    : `${sourceLabel} expiry date is used first. Existing customers also keep their inherited due day.`}
                </p>
                <label className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    id="myisp-auto-pay-due"
                    type="checkbox"
                    checked={autoPayDue}
                    disabled={isBusy}
                    onChange={(event) => setAutoPayDue(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="myisp-auto-pay-due" className="font-normal text-muted-foreground">
                    Fallback when no due date: billing month +
                  </Label>
                  <Input
                    aria-label="Fallback due date offset"
                    type="number"
                    min={0}
                    max={90}
                    value={payDueDayOffset}
                    disabled={!autoPayDue || isBusy}
                    onChange={(event) => setPayDueDayOffset(Math.max(0, parseInt(event.target.value, 10) || 0))}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">days</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">
                  {source === 'radius' ? 'Only active RADIUS users are selected' : 'Credentials remain on the backend'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {source === 'radius'
                    ? 'The amount comes from each user’s assigned profile price; expired and disabled users are excluded.'
                    : `Password fields from the ${sourceLabel} export are discarded and never returned to this screen.`}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" disabled={isBusy || !billingMonth} onClick={() => void fetchPreview()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
              {previewMutation.isPending ? 'Fetching…' : preview ? 'Refresh preview' : 'Fetch preview'}
            </Button>
          </div>

          {preview ? (
            <div className="space-y-4 rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Invoice preview</p>
                  <p className="text-sm text-muted-foreground">
                    {preview.totalRows} {sourceLabel} user(s): {preview.validRowCount} ready, {preview.skippedRowCount} skipped
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Provider: {source}</Badge>
                  <Badge variant="outline">Month: {billingMonth}</Badge>
                </div>
              </div>

              {preview.issues.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    Validation notes ({preview.issues.length})
                  </div>
                  <ul className="max-h-32 space-y-1 overflow-auto text-xs text-amber-900/90 dark:text-amber-100/90">
                    {preview.issues.slice(0, 12).map((issue, index) => (
                      <li key={`${issue.row}-${issue.field}-${index}`}>
                        Row {issue.row}, {issue.field}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Pay due</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.mappedPreview.map((row, index) => (
                      <TableRow key={`${String(row.username ?? '')}-${index}`}>
                        <TableCell className="font-mono text-xs">{String(row.username ?? '—')}</TableCell>
                        <TableCell>{String(row.fullName ?? '—')}</TableCell>
                        <TableCell>{String(row.debitLabel ?? '—')}</TableCell>
                        <TableCell>${Number(row.amount ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{String(row.payDueDate ?? '—')}</TableCell>
                        <TableCell>{String(row.phoneNumber ?? '—')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {preview.mappedPreview.length} sample row(s). Import fetches a fresh export and applies
                duplicate merging, carryover, and scoped upsert for this billing month.
              </p>
            </div>
          ) : previewMutation.isPending ? (
            <p className="text-sm text-muted-foreground">
              {source === 'radius' ? 'Reading active RADIUS users' : `Signing in to ${sourceLabel}`} and building the preview…
            </p>
          ) : null}

          {lastImportSummary ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Last import: {lastImportSummary}</span>
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!preview?.validRowCount || isBusy}
            onClick={() => void runImport()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Importing…' : `Import ${preview?.validRowCount ?? 0} invoice(s)`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
