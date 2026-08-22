"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Wifi, ShieldCheck, QrCode } from "lucide-react";
import type { VoucherBatch, VoucherCard } from "./Vouchers";

export default function VoucherPrintSheet() {
  const router = useRouter();
  const { batchId } = useParams();

  const batchQuery = useQuery({
    queryKey: ["vouchers", "print", batchId],
    queryFn: async (): Promise<{ batch: VoucherBatch; cards: VoucherCard[] } | null> => {
      if (!batchId) return null;
      const { data } = await apiClient.get(`/vouchers/batches/${batchId}`);
      return data?.data ?? null;
    },
    enabled: Boolean(batchId),
  });

  const batch = batchQuery.data?.batch;
  const cards = batchQuery.data?.cards ?? [];

  const [gridCols, setGridCols] = React.useState<number>(3);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-4 sm:p-8 print:p-0 print:bg-white print:text-black">
      {/* Top action bar (hidden on print) */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden bg-card p-4 rounded-2xl border border-border/80 shadow-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vouchers")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Vouchers
          </Button>
          <div>
            <h1 className="text-base font-bold">{batch?.name || "Voucher Print Sheet"}</h1>
            <p className="text-xs text-muted-foreground">
              {cards.length} cards ready to print • Plan: {batch?.profileName} (${Number(batch?.price || 0).toFixed(2)})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-border/60 rounded-lg p-1 bg-muted/20 text-xs">
            <span className="text-muted-foreground px-1 font-semibold">Grid:</span>
            {[2, 3, 4].map((cols) => (
              <button
                key={cols}
                type="button"
                onClick={() => setGridCols(cols)}
                className={`px-2 py-0.5 rounded font-semibold transition-all ${
                  gridCols === cols ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {cols} Cols
              </button>
            ))}
          </div>

          <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground shadow-sm">
            <Printer className="h-4 w-4" />
            Print Sheet
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-5xl mx-auto space-y-4 print:space-y-0">
        <div
          className={`grid grid-cols-1 gap-4 print:gap-3 ${
            gridCols === 2
              ? "sm:grid-cols-2 md:grid-cols-2 print:grid-cols-2"
              : gridCols === 4
                ? "sm:grid-cols-2 md:grid-cols-4 print:grid-cols-4"
                : "sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3"
          }`}
        >
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className="relative rounded-xl border-2 border-neutral-300 dark:border-neutral-700 print:border-black bg-white dark:bg-neutral-950 p-4 shadow-sm flex flex-col justify-between overflow-hidden print:shadow-none print:break-inside-avoid"
              style={{ minHeight: "190px" }}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      <Wifi className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-xs tracking-tight">XNET INTERNET</span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-100 px-2 py-0.5 rounded">
                    ${Number(card.price).toFixed(2)}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                      Subscription Plan
                    </div>
                    <div className="font-bold text-sm text-emerald-700 dark:text-emerald-400 print:text-black">
                      {card.profileName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                      Validity
                    </div>
                    <div className="font-bold text-xs">{card.durationDays} Days</div>
                  </div>
                </div>
              </div>

              {/* Scratch Area */}
              <div className="my-3 py-2 px-3 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 print:bg-neutral-50 text-center">
                <div className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">
                  Scratch Off PIN Code
                </div>
                <div className="font-mono text-sm font-black tracking-widest text-emerald-800 dark:text-emerald-300 print:text-black mt-0.5">
                  {card.pinCode}
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between text-[10px] text-neutral-500 print:text-neutral-700 border-t border-neutral-100 dark:border-neutral-800 print:border-neutral-300 pt-1.5">
                <span className="font-mono">S/N: {card.serialNumber}</span>
                <span className="italic">Redeem at user portal</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
