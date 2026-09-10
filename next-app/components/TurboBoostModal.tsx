"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";
import {
  Zap,
  CheckCircle2,
  Wallet,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

interface TurboBoostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriberUsername?: string;
  onPurchased?: () => void;
}

interface TopupPlan {
  id: number;
  name: string;
  gb: number;
  price: number;
  formattedPrice: string;
  formattedQuota: string;
}

export function TurboBoostModal({
  open,
  onOpenChange,
  subscriberUsername,
  onPurchased,
}: TurboBoostModalProps) {
  const qc = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"invoice_debit" | "wallet">("invoice_debit");

  // Fetch top-up options and subscriber status
  const { data, isLoading } = useQuery({
    queryKey: ["topup-plans", subscriberUsername],
    queryFn: async () => {
      try {
        if (subscriberUsername) {
          const resp = await apiClient.get(`/topups/subscribers/${encodeURIComponent(subscriberUsername)}`);
          const plansResp = await apiClient.get("/topups/plans");
          return {
            plans: plansResp.data?.data || [],
            walletBalance: resp.data?.data?.walletBalance ?? 0,
            activeTopupBytes: resp.data?.data?.activeTopupBytes ?? "0",
          };
        } else {
          const resp = await apiClient.get("/subscriber/topup-plans");
          return resp.data?.data || { plans: [], walletBalance: 0, activeExtraBytes: "0" };
        }
      } catch {
        // Fallback default plans
        return {
          plans: [
            { id: 1, name: "Turbo Boost 20GB", gb: 20, price: 3.0, formattedPrice: "$3.00", formattedQuota: "20 GB" },
            { id: 2, name: "Turbo Boost 50GB", gb: 50, price: 6.0, formattedPrice: "$6.00", formattedQuota: "50 GB" },
            { id: 3, name: "Turbo Boost 120GB", gb: 120, price: 12.0, formattedPrice: "$12.00", formattedQuota: "120 GB" },
            { id: 4, name: "Turbo Boost 300GB", gb: 300, price: 25.0, formattedPrice: "$25.00", formattedQuota: "300 GB" },
          ],
          walletBalance: 15.0,
          activeTopupBytes: "0",
        };
      }
    },
    enabled: open,
  });

  const plans: TopupPlan[] = data?.plans || [];
  const walletBalance = Number(data?.walletBalance ?? 0);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId) throw new Error("Please select a top-up pack");
      if (subscriberUsername) {
        const resp = await apiClient.post("/topups/purchase", {
          username: subscriberUsername,
          planId: selectedPlanId,
          paymentMethod,
        });
        return resp.data?.data;
      } else {
        const resp = await apiClient.post("/subscriber/buy-topup", {
          planId: selectedPlanId,
          paymentMethod,
        });
        return resp.data?.data;
      }
    },
    onSuccess: (res) => {
      notify.success(
        "Turbo Boost Activated! 🚀",
        res?.message || "Extra quota has been added to your line."
      );
      qc.invalidateQueries({ queryKey: ["subscriber-portal"] });
      qc.invalidateQueries({ queryKey: ["topup-plans"] });
      onPurchased?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      notify.error("Purchase Failed", err?.response?.data?.message || err?.message || "Unable to activate pack");
    },
  });

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const canAffordWallet = selectedPlan ? walletBalance >= selectedPlan.price : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border/70 shadow-2xl">
        <DialogHeader className="p-5 border-b border-border/50 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Activate Turbo Boost Data Pack
                <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Instant CoA
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add on-demand high-speed gigabytes and immediately restore line throttles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Step 1: Select Pack */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>1. Choose Extra Quota Pack:</span>
              <span className="text-[11px] font-normal text-muted-foreground">Valid through current cycle</span>
            </Label>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                Loading top-up packs...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/20"
                          : "border-border/60 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 text-amber-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-base text-foreground font-mono">
                          +{p.gb} <span className="text-xs font-normal">GB</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {p.name}
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {p.formattedPrice}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Payment Settlement Method */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-foreground">
              2. Select Payment Settlement:
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("invoice_debit")}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  paymentMethod === "invoice_debit"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentMethod === "invoice_debit" ? "border-primary bg-primary text-white" : "border-muted-foreground/50"
                }`}>
                  {paymentMethod === "invoice_debit" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Bill to Monthly Invoice
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Added as an itemized line on your next external bill.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  paymentMethod === "wallet"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentMethod === "wallet" ? "border-primary bg-primary text-white" : "border-muted-foreground/50"
                }`}>
                  {paymentMethod === "wallet" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    Deduct from Wallet
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Balance: ${walletBalance.toFixed(2)}
                    {selectedPlan && !canAffordWallet && (
                      <span className="text-rose-500 ml-1 block">(Insufficient)</span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Guarantee Banner */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Immediate Line Restoration: </span>
              If your line speed is currently restricted due to Fair Usage Policy (FUP), purchasing this pack automatically re-negotiates your network profile and restores full purchased speed in seconds.
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="text-xs">
            {selectedPlan ? (
              <span className="text-muted-foreground">
                Selected: <strong className="text-foreground">{selectedPlan.name}</strong> for{" "}
                <strong className="text-amber-600 dark:text-amber-400">{selectedPlan.formattedPrice}</strong>
              </span>
            ) : (
              <span className="text-muted-foreground">Please select a pack above</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedPlanId || purchaseMutation.isPending || (paymentMethod === "wallet" && !canAffordWallet)}
              onClick={() => purchaseMutation.mutate()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 fill-white" />
              )}
              Activate Turbo Boost
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
