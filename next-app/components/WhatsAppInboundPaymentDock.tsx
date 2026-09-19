"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWhatsAppInboundPaymentQueue } from "@/context/WhatsAppInboundPaymentContext";

export const WhatsAppInboundPaymentDock: React.FC = () => {
  const router = useRouter();
  const { items, isDockOpen, setIsDockOpen, clearItems, removeItem } = useWhatsAppInboundPaymentQueue();

  const totalCollected = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2 max-w-[calc(100vw-2rem)] pointer-events-none">
      {/* Minimized Dock Button */}
      {!isDockOpen && (
        <button
          type="button"
          onClick={() => setIsDockOpen(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300",
            "bg-card/95 backdrop-blur-md border border-emerald-500/40 text-card-foreground",
            "hover:scale-[1.03] hover:border-emerald-500 hover:shadow-emerald-500/20",
            "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background animate-bounce"
          )}
        >
          <div className="relative flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <MessageCircle className="h-3.5 w-3.5" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-xs">
              {items.length}
            </span>
          </div>

          <div className="text-left text-xs">
            <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>{items.length === 1 ? "1 Invoice Auto-Paid" : `${items.length} Invoices Auto-Paid`}</span>
              {totalCollected > 0 && <span className="font-mono text-foreground font-semibold">(${totalCollected.toFixed(2)})</span>}
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
              {items[0].fullName}
            </div>
          </div>

          <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
        </button>
      )}

      {/* Expanded Dock Panel */}
      {isDockOpen && (
        <div
          className={cn(
            "pointer-events-auto w-[400px] max-w-full rounded-2xl border border-emerald-500/40 shadow-2xl",
            "bg-card/95 backdrop-blur-xl text-card-foreground flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-emerald-500/15 via-muted/40 to-emerald-500/10">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-sm font-bold flex items-center gap-1.5">
                  WhatsApp Auto-Payments
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    Live
                  </Badge>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearItems}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Clear list"
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDockOpen(false)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Minimize"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List of auto-paid invoices */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl transition-all hover:bg-muted/40 flex flex-col gap-1.5 bg-background/60 border border-border/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5">
                        <span className="truncate">{item.fullName}</span>
                        {item.username && (
                          <span className="text-[11px] font-mono text-muted-foreground font-normal">
                            ({item.username})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          ${item.amount > 0 ? item.amount.toFixed(2) : "—"}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">Inv #{item.invoiceId}</span>
                        {item.matchedName && (
                          <>
                            <span>•</span>
                            <span className="truncate italic text-[10px] text-foreground font-medium max-w-[100px]" title={item.matchedName}>
                              &ldquo;{item.matchedName}&rdquo;
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10 gap-1 py-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Paid
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Action Links */}
          <div className="p-2.5 bg-muted/40 border-t border-border/60 flex items-center justify-between text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                router.push("/invoices");
                setIsDockOpen(false);
              }}
              className="h-7 text-xs gap-1 text-primary hover:text-primary"
            >
              External Invoices
              <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                router.push("/whatsapp");
                setIsDockOpen(false);
              }}
              className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400"
            >
              Inbound Queue
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
