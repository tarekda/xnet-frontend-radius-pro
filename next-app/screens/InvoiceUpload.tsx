import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { useInvoiceImportPreview } from '@/hooks/useInvoiceImportPreview';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { downloadExternalInvoiceImportTemplate } from "@/lib/externalInvoiceImportTemplate";
import ExternalInvoiceImportPreviewPanel from '@/components/ExternalInvoiceImportPreviewPanel';
import {
  detectProviderFromMapping,
  loadSavedMapping,
  saveMappingForProvider,
  type ImportColumnMapping,
  type ImportPreviewData,
} from '@/lib/externalInvoiceImport';
import { useQueryClient } from '@tanstack/react-query';

const InvoiceUpload: React.FC = () => {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [autoPayDue, setAutoPayDue] = useState(false);
  const [payDueDayOffset, setPayDueDayOffset] = useState(15);
  const [rememberMapping, setRememberMapping] = useState(true);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});
  const [billingMonth, setBillingMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const previewMutation = useInvoiceImportPreview();
  const uploadMutation = useInvoiceUpload();

  const runPreview = useCallback(
    async (selectedFile: File, mapping?: ImportColumnMapping) => {
      try {
        const data = await previewMutation.mutateAsync({
          file: selectedFile,
          billingMonth,
          columnMapping: mapping,
        });
        setPreview(data);
        const nextMapping = mapping && Object.keys(mapping).length > 0 ? mapping : data.suggestedMapping;
        const provider = detectProviderFromMapping(nextMapping, data.mappedPreview);
        const saved = provider ? loadSavedMapping(provider) : null;
        setColumnMapping(saved ? { ...nextMapping, ...saved } : nextMapping);
      } catch (err) {
        console.error(err);
        notify.error('Preview failed', 'Could not read the Excel file. Check format and try again.');
        setPreview(null);
      }
    },
    [billingMonth, previewMutation]
  );

  const acceptFile = (selectedFile: File | undefined) => {
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile);
      setUploadProgress(0);
      setLastImportSummary(null);
      setPreview(null);
      void runPreview(selectedFile);
    } else if (selectedFile) {
      notify.error(MESSAGES.invoiceUpload.invalidFileTitle, MESSAGES.invoiceUpload.invalidFileDescription);
    }
  };

  useEffect(() => {
    if (file) void runPreview(file, columnMapping);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingMonth]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      acceptFile(e.dataTransfer.files[0]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [billingMonth]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    if (!billingMonth) {
      notify.error(MESSAGES.invoiceUpload.billingMonthRequiredTitle, MESSAGES.invoiceUpload.billingMonthRequiredDescription);
      return;
    }
    if (!columnMapping.username) {
      notify.error('Column mapping required', 'Map the username column before importing.');
      return;
    }

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
      }, 200);

      const result = await uploadMutation.mutateAsync({
        file,
        billingMonth,
        payDueDayOffset: autoPayDue ? payDueDayOffset : undefined,
        columnMapping,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (rememberMapping) {
        const provider = detectProviderFromMapping(columnMapping, preview?.mappedPreview ?? []);
        if (provider) saveMappingForProvider(provider, columnMapping);
      }

      await qc.invalidateQueries({ queryKey: ['externalInvoices'] });
      await qc.invalidateQueries({ queryKey: ['externalInvoicesPaymentDue'] });
      await qc.invalidateQueries({ queryKey: ['invoices'] });

      const stats = result?.data;
      const summary = stats
        ? `${stats.inserted} new, ${stats.updated} updated${stats.mergedDuplicates ? `, ${stats.mergedDuplicates} duplicate rows merged` : ''}${stats.removedFromScope ? `, ${stats.removedFromScope} removed from billing month` : ''}${stats.skippedRows ? `, ${stats.skippedRows} rows skipped` : ''}${stats.enrichedFromUserDetails ? `, ${stats.enrichedFromUserDetails} enriched from user profiles` : ''}${stats.inheritedPayDueDates ? `, ${stats.inheritedPayDueDates} pay due dates inherited` : ''}${stats.inheritedCarryoverLines ? `, ${stats.inheritedCarryoverLines} carryover lines added` : ''}.`
        : MESSAGES.invoiceUpload.uploadSuccessDescription;
      setLastImportSummary(summary);
      notify.success(MESSAGES.invoiceUpload.uploadSuccessTitle, summary);

      setTimeout(() => {
        setFile(null);
        setPreview(null);
        setUploadProgress(0);
      }, 2000);
    } catch (err) {
      console.error('Upload failed:', err);
      notify.error(MESSAGES.invoiceUpload.uploadFailedTitle, MESSAGES.common.actionFailed);
    }
  };

  const isLoading = previewMutation.isPending || uploadMutation.isPending;
  const uploadError = previewMutation.error || uploadMutation.error;

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader
        title="Upload Invoice"
        subtitle="Import external invoices — preview columns, map fields, then upsert by username + billing month + provider"
        icon={FileSpreadsheet}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Upload Invoice File</CardTitle>
              <CardDescription className="mt-1.5">
                Select an Excel file to preview the first rows and map columns. Standard template columns work automatically;
                other layouts (e.g. from upstream billing systems) can be mapped before import.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadExternalInvoiceImportTemplate()}>
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="billing-month" className="text-sm font-medium">
                  Billing month
                </label>
                <Input
                  id="billing-month"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label className="text-sm font-medium">Pay due on import</Label>
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 text-sm">
                  <p className="text-muted-foreground">
                    Due dates are inherited automatically from each customer&apos;s latest prior invoice
                    (same day-of-month in the billing month you selected). Unpaid carryover lines from the
                    previous month are added when missing from the file.
                  </p>
                  <label className="flex items-center gap-2">
                    <input
                      id="auto-pay-due"
                      type="checkbox"
                      checked={autoPayDue}
                      onChange={(e) => setAutoPayDue(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="auto-pay-due" className="text-sm font-normal text-muted-foreground">
                      Fallback when no prior due date: billing month +
                    </Label>
                    <Input
                      id="pay-due-offset"
                      type="number"
                      min={0}
                      max={90}
                      disabled={!autoPayDue}
                      value={payDueDayOffset}
                      onChange={(e) => setPayDueDayOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">days</span>
                  </label>
                </div>
              </div>
            </div>

            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                file ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-2">
                {file ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop your file here</p>
                    <p className="text-xs text-muted-foreground">or click to select — preview runs automatically</p>
                  </>
                )}
              </div>
              <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls" className="hidden" id="file-upload" />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
              >
                Select File
              </label>
            </div>

            {preview ? (
              <ExternalInvoiceImportPreviewPanel
                preview={preview}
                mapping={columnMapping}
                onMappingChange={setColumnMapping}
                onRefreshPreview={() => file && runPreview(file, columnMapping)}
                isRefreshing={previewMutation.isPending}
                rememberMapping={rememberMapping}
                onRememberMappingChange={setRememberMapping}
              />
            ) : previewMutation.isPending ? (
              <p className="text-sm text-muted-foreground">Reading file and building preview…</p>
            ) : null}

            {isLoading && uploadMutation.isPending ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            ) : null}

            {lastImportSummary && !uploadMutation.isPending ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                Last import: {lastImportSummary}
              </div>
            ) : null}

            {uploadError ? (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Could not complete the request. Check the file and try again.</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={!file || !preview || !columnMapping.username || uploadMutation.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? 'Importing…' : `Import ${preview?.validRowCount ?? 0} row(s)`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceUpload;
