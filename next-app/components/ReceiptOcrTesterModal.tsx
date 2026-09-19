import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  Search,
  Sparkles,
  UserCheck,
  Loader2,
} from "lucide-react";

interface ReceiptOcrTesterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconciled?: () => void;
}

export function ReceiptOcrTesterModal({
  open,
  onOpenChange,
  onReconciled,
}: ReceiptOcrTesterModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const resetState = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsScanning(false);
    setScanResult(null);
    setSelectedInvoiceId(null);
    setManualSearch("");
    setManualSearchResults([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      setScanResult(null);
      setSelectedInvoiceId(null);
    }
  };

  const handleRunOcr = async () => {
    if (!file) return;
    setIsScanning(true);
    setScanResult(null);
    setSelectedInvoiceId(null);

    const formData = new FormData();
    formData.append("receipt", file);

    try {
      const { data } = await apiClient.post("/invoices/external/receipt-ocr/upload-test", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.ok) {
        setScanResult(data.data);
        const matchResult = data.data?.matchResult;
        if (matchResult?.status === "matched" && matchResult?.matchedInvoice?.id) {
          setSelectedInvoiceId(matchResult.matchedInvoice.id);
        }
        notify.success("OCR Scan Complete", `Detected ${data.data?.extracted?.provider?.toUpperCase() || "Receipt"} slip.`);
      } else {
        notify.error("OCR Failed", data?.error || "Unable to extract receipt details.");
      }
    } catch (err: any) {
      notify.error("Upload Error", err?.response?.data?.error || err?.message || "Error processing image.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualSearch.trim() || manualSearch.trim().length < 2) return;
    setIsSearchingManual(true);
    try {
      const { data } = await apiClient.get("/invoices/external", {
        params: { search: manualSearch.trim(), status: "unpaid", limit: 6 },
      });
      setManualSearchResults(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      notify.error("Search failed", err?.message);
    } finally {
      setIsSearchingManual(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoiceId || !scanResult) return;
    setIsConfirming(true);
    try {
      const { data } = await apiClient.post("/invoices/external/receipt-ocr/confirm", {
        invoiceId: selectedInvoiceId,
        receiptData: scanResult.extracted,
        mediaUrl: scanResult.mediaUrl,
      });

      if (data?.ok) {
        notify.success("Invoice Reconciled & Marked Paid", data.message || `Invoice #${selectedInvoiceId} paid successfully.`);
        onOpenChange(false);
        resetState();
        onReconciled?.();
      } else {
        notify.error("Payment Failed", data?.error || "Could not apply receipt payment.");
      }
    } catch (err: any) {
      notify.error("Reconciliation Error", err?.response?.data?.error || err?.message || "Failed to confirm.");
    } finally {
      setIsConfirming(false);
    }
  };

  const extracted = scanResult?.extracted;
  const matchResult = scanResult?.matchResult;
  const candidateInvoices: any[] = matchResult?.candidateInvoices || [];
  const allCandidates = [...candidateInvoices, ...manualSearchResults.filter(m => !candidateInvoices.some(c => c.id === m.id))];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Receipt Slip Scanner & Automated OCR Matcher
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload or drop a payment receipt screenshot (Whish Money, OMT, BOB Finance, Bank Slip) to extract payment data and auto-reconcile open invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* File Upload Zone */}
          {!file ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                aria-label="Upload payment receipt file"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload or drop a payment receipt screenshot"
                className="w-full border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <div className="text-sm font-semibold text-foreground">Click to upload payment slip screenshot</div>
                <div className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, JPEG, WEBP, or PDF up to 10MB</div>
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    IMG
                  </div>
                  <div>
                    <div className="text-xs font-semibold truncate max-w-[240px]">{file.name}</div>
                    <div className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      resetState();
                      fileInputRef.current?.click();
                    }}
                    disabled={isScanning}
                  >
                    Change Image
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                    onClick={handleRunOcr}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Scanning OCR...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Scan & Match Slip
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Preview & OCR Results Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left: Preview */}
                <div className="rounded-lg border border-border/60 overflow-hidden bg-black/5 flex items-center justify-center max-h-[280px]">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Receipt Preview"
                      className="object-contain max-h-[270px] w-full"
                    />
                  )}
                </div>

                {/* Right: Detected Data */}
                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2.5">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Extracted Metadata</span>
                    {extracted && (
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {Math.round((extracted.confidence || 0) * 100)}% Confidence
                      </Badge>
                    )}
                  </div>

                  {isScanning ? (
                    <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-2 text-xs">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>Reading receipt text via OCR...</span>
                    </div>
                  ) : !extracted ? (
                    <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-1 text-xs">
                      <Camera className="h-6 w-6 opacity-40" />
                      <span>Click &quot;Scan &amp; Match Slip&quot; to run OCR</span>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Provider</span>
                        <Badge className="capitalize font-semibold text-[11px] bg-primary/10 text-primary hover:bg-primary/20">
                          {extracted.provider}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Detected Amount</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {extracted.amount != null ? `${extracted.amount} ${extracted.currency}` : "Not detected"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Reference / MTCN</span>
                        <span className="font-mono font-medium truncate max-w-[150px]">
                          {extracted.referenceId || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Detected Name(s)</span>
                        <span className="font-medium text-right truncate max-w-[150px]">
                          {extracted.candidateNames?.join(", ") || extracted.senderName || "—"}
                        </span>
                      </div>

                      {extracted.phoneNumber && (
                        <div className="flex items-center justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Detected Phone</span>
                          <span className="font-mono">{extracted.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Match Results & Invoices Selection */}
              {scanResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      Candidate Invoices ({allCandidates.length})
                    </div>
                    {matchResult?.status === "matched" && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[10px]">
                        Exact Match Found
                      </Badge>
                    )}
                    {matchResult?.status === "ambiguous" && (
                      <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[10px]">
                        Multiple Candidates (Ambiguous)
                      </Badge>
                    )}
                    {matchResult?.status === "no_match" && allCandidates.length === 0 && (
                      <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px]">
                        No Automatic Match
                      </Badge>
                    )}
                  </div>

                  {/* Candidates List */}
                  {allCandidates.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {allCandidates.map((inv) => {
                        const isSelected = selectedInvoiceId === inv.id;
                        return (
                          <div
                            key={inv.id}
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                                : "border-border/60 hover:border-border bg-card"
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-2">
                                <span>{inv.fullName}</span>
                                <span className="font-mono text-[11px] text-muted-foreground font-normal">
                                  (@{inv.username})
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Invoice #{inv.id} · Billing: {inv.billingMonth || "—"} · Phone: {inv.phone || inv.mobile || "—"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-foreground">
                                ${Number(inv.totalAmount ?? inv.amount ?? 0).toFixed(2)}
                              </div>
                              {isSelected ? (
                                <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px] mt-0.5">
                                  Selected
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Click to select</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No automated candidate was found matching the slip name. Search for the subscriber below.
                    </div>
                  )}

                  {/* Manual search fallback */}
                  <div className="pt-2 border-t border-border/40 flex items-center gap-2">
                    <Input
                      placeholder="Search subscriber name or username to link..."
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs shrink-0"
                      onClick={handleManualSearch}
                      disabled={isSearchingManual || !manualSearch.trim()}
                    >
                      {isSearchingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Search
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border/40 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            disabled={!selectedInvoiceId || isConfirming}
            onClick={handleConfirmPayment}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying Payment...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm & Reconcile Invoice #{selectedInvoiceId || "..."}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
