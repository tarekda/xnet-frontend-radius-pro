import React, { useState, useCallback } from 'react';
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { downloadExternalInvoiceImportTemplate } from "@/lib/externalInvoiceImportTemplate";

const InvoiceUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [autoPayDue, setAutoPayDue] = useState(false);
  const [inheritPayDueFromPrior, setInheritPayDueFromPrior] = useState(true);
  const [payDueDayOffset, setPayDueDayOffset] = useState(15);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [billingMonth, setBillingMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { uploadInvoice, isLoading, error } = useInvoiceUpload();

  const acceptFile = (selectedFile: File | undefined) => {
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile);
      setUploadProgress(0);
      setLastImportSummary(null);
    } else if (selectedFile) {
      notify.error(MESSAGES.invoiceUpload.invalidFileTitle, MESSAGES.invoiceUpload.invalidFileDescription);
    }
  };

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

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file) {
      if (!billingMonth) {
        notify.error(MESSAGES.invoiceUpload.billingMonthRequiredTitle, MESSAGES.invoiceUpload.billingMonthRequiredDescription);
        return;
      }
      try {
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadInvoice(
          file,
          billingMonth,
          autoPayDue ? payDueDayOffset : undefined,
          inheritPayDueFromPrior
        );
        clearInterval(progressInterval);
        setUploadProgress(100);

        const stats = result?.data;
        const summary = stats
          ? `${stats.inserted} new, ${stats.updated} updated${stats.removedFromScope ? `, ${stats.removedFromScope} removed from billing month` : ''}${stats.enrichedFromUserDetails ? `, ${stats.enrichedFromUserDetails} enriched from user profiles` : ''}${stats.inheritedPayDueDates ? `, ${stats.inheritedPayDueDates} pay due dates inherited` : ''}.`
          : MESSAGES.invoiceUpload.uploadSuccessDescription;
        setLastImportSummary(summary);
        notify.success(MESSAGES.invoiceUpload.uploadSuccessTitle, summary);

        setTimeout(() => {
          setFile(null);
          setUploadProgress(0);
        }, 2000);
      } catch (err) {
        console.error('Upload failed:', err);
        notify.error(MESSAGES.invoiceUpload.uploadFailedTitle, error || MESSAGES.common.actionFailed);
      }
    }
  };

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader
        title="Upload Invoice"
        subtitle="Import external invoices from Excel — upserts by username + billing month + provider"
        icon={FileSpreadsheet}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Upload Invoice File</CardTitle>
              <CardDescription className="mt-1.5">
                Drag and drop your Excel file or browse. Columns:{" "}
                <span className="font-medium">username</span>, <span className="font-medium">fullName</span>,{" "}
                <span className="font-medium">email</span>, <span className="font-medium">phoneNumber</span>,{" "}
                <span className="font-medium">address</span>, <span className="font-medium">provider</span>, optional{" "}
                <span className="font-medium">debitLabel</span> (second charge e.g. carryover),{" "}
                <span className="font-medium">amount</span>, optional{" "}
                <span className="font-medium">payDueDate</span> / <span className="font-medium">paydate</span>,{" "}
                <span className="font-medium">billingMonth</span>, <span className="font-medium">status</span>.
                Empty address is filled from RADIUS user profile when available.
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
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={inheritPayDueFromPrior}
                      onChange={(e) => setInheritPayDueFromPrior(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <span>
                      <span className="font-medium">Inherit due day from prior unpaid invoice</span>
                      <span className="block text-xs text-muted-foreground">
                        When the sheet has no pay due date, use the same day-of-month as the customer&apos;s latest unpaid line (recommended for beginning-of-month imports).
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      id="auto-pay-due"
                      type="checkbox"
                      checked={autoPayDue}
                      onChange={(e) => setAutoPayDue(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="auto-pay-due" className="text-sm font-normal text-muted-foreground">
                      Otherwise billing month +
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
                    <span className="text-sm text-muted-foreground">days</span>
                  </label>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                file ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""
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
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop your file here</p>
                    <p className="text-xs text-muted-foreground">or click to select a file</p>
                  </>
                )}
              </div>
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".xlsx,.xls"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
              >
                Select File
              </label>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {lastImportSummary && !isLoading ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                Last import: {lastImportSummary}
              </div>
            ) : null}

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={!file || isLoading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isLoading ? 'Uploading...' : 'Upload Invoice'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceUpload;
