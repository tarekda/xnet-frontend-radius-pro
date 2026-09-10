"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock, Search, Filter, Download, ArrowUpRight,
  AlertTriangle, DollarSign, Clock, RefreshCw, Send, CheckCircle2,
  FileText, ShieldAlert, ArrowRight, User
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/client";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";

export interface AgingBucketTotal {
  count: number;
  amount: number;
}

export interface OverdueRow {
  id: number;
  username: string;
  fullName?: string;
  amount: number;
  amountPaid?: number;
  remainingDue?: number;
  overdueDays: number;
  billingMonth?: string;
  bucket?: string;
}

export interface AgingSummaryResponse {
  bucketTotals: {
    current: AgingBucketTotal;
    "1_30": AgingBucketTotal;
    "31_60": AgingBucketTotal;
    "61_90": AgingBucketTotal;
    "90_plus": AgingBucketTotal;
  };
  overdueRows: OverdueRow[];
  totalOverdueAmount: number;
  totalOpenInvoices: number;
}

const BUCKET_CONFIG: Record<
  string,
  { label: string; badge: string; border: string; bg: string; text: string }
> = {
  current: {
    label: "Current (0-7d)",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "1_30": {
    label: "1 - 30 Days",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
  },
  "31_60": {
    label: "31 - 60 Days",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
  },
  "61_90": {
    label: "61 - 90 Days",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
  },
  "90_plus": {
    label: "90+ Days (Severe)",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
  },
};

export default function AgingReport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [graceDays, setGraceDays] = useState<number>(7);

  const { data, isLoading, refetch } = useQuery<AgingSummaryResponse>({
    queryKey: ["invoices", "aging-summary", graceDays],
    queryFn: async () => {
      const resp = await apiClient.get("/invoices/external/aging-summary", {
        params: { graceDays },
      });
      return resp.data?.data;
    },
    staleTime: 30000,
  });

  const bucketTotals = data?.bucketTotals ?? {
    current: { count: 0, amount: 0 },
    "1_30": { count: 0, amount: 0 },
    "31_60": { count: 0, amount: 0 },
    "61_90": { count: 0, amount: 0 },
    "90_plus": { count: 0, amount: 0 },
  };

  const rows = data?.overdueRows ?? [];

  // Categorize row bucket if not already assigned
  const categorizedRows = useMemo(() => {
    return rows.map((r) => {
      let b = "current";
      if (r.overdueDays > 90) b = "90_plus";
      else if (r.overdueDays > 60) b = "61_90";
      else if (r.overdueDays > 30) b = "31_60";
      else if (r.overdueDays > 0) b = "1_30";
      return { ...r, bucket: b };
    });
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return categorizedRows.filter((r) => {
      const matchesSearch =
        r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.id).includes(searchTerm);
      const matchesBucket = selectedBucket === "all" || r.bucket === selectedBucket;
      return matchesSearch && matchesBucket;
    });
  }, [categorizedRows, searchTerm, selectedBucket]);

  const totalOutstanding = useMemo(() => {
    return Object.values(bucketTotals).reduce((sum, b) => sum + (b?.amount || 0), 0);
  }, [bucketTotals]);

  // CSV Export handler
  const exportCsv = () => {
    const headers = ["Invoice ID", "Username", "Subscriber Name", "Overdue Days", "Bucket", "Amount Due ($)"];
    const csvLines = filteredRows.map((r) => [
      r.id,
      `"${r.username}"`,
      `"${r.fullName || ""}"`,
      r.overdueDays,
      BUCKET_CONFIG[r.bucket || "current"]?.label || r.bucket,
      Number(r.amount || 0).toFixed(2),
    ].join(","));

    const blob = new Blob([[headers.join(","), ...csvLines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Aging_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      {/* Header */}
      <PageHeader
        title="Accounts Receivable Aging Report"
        subtitle="Track unpaid invoice aging buckets, credit exposure, and collection delinquency across all subscriber accounts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredRows.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button size="sm" asChild>
              <Link href="/external-invoices/dunning">
                <Send className="h-4 w-4 mr-1" />
                Dunning Center
              </Link>
            </Button>
          </div>
        }
      />

      {/* Aging Bucket Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {/* Total Outstanding */}
        <Card className="border-border/60 shadow-sm col-span-1 sm:col-span-2 xl:col-span-1 bg-muted/20">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold">Total Outstanding AR</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight">
              ${Math.round(totalOutstanding).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            {rows.length} total open invoice{rows.length !== 1 ? "s" : ""}
          </CardContent>
        </Card>

        {/* 5 Buckets */}
        {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => {
          const b = bucketTotals[key as keyof typeof bucketTotals] || { count: 0, amount: 0 };
          const isSelected = selectedBucket === key;

          return (
            <Card
              key={key}
              onClick={() => setSelectedBucket(selectedBucket === key ? "all" : key)}
              className={cn(
                "border shadow-sm cursor-pointer transition-all hover:shadow-md",
                cfg.border,
                isSelected ? `${cfg.bg} ring-2 ring-primary/40` : "bg-card"
              )}
            >
              <CardHeader className="pb-1 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{cfg.label}</span>
                  <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0", cfg.badge)}>
                    {b.count} inv
                  </Badge>
                </div>
                <CardTitle className={cn("text-xl font-bold font-mono", cfg.text)}>
                  ${Math.round(b.amount || 0).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 text-[11px] text-muted-foreground">
                {totalOutstanding > 0 ? `${((b.amount / totalOutstanding) * 100).toFixed(0)}% of total AR` : "0%"}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subscriber, username, or invoice ID..."
            className="pl-9 h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Grace:</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={graceDays}
              onChange={(e) => setGraceDays(parseInt(e.target.value) || 7)}
            >
              <option value={3}>3 Days</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days (Default)</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={selectedBucket === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedBucket("all")}
            >
              All ({categorizedRows.length})
            </Button>
            {Object.entries(BUCKET_CONFIG).map(([k, c]) => (
              <Button
                key={k}
                variant={selectedBucket === k ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs hidden lg:inline-flex"
                onClick={() => setSelectedBucket(k)}
              >
                {c.label.split(" ")[0]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue Receivables Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Overdue Invoices Ledger</CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredRows.length} invoice{filteredRows.length !== 1 ? "s" : ""}
                {selectedBucket !== "all" ? ` in ${BUCKET_CONFIG[selectedBucket]?.label}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Calculating aging buckets and receivables…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-60" />
              <p className="font-semibold text-sm">No overdue invoices found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchTerm ? "Try searching with different terms." : "All customer accounts are in good standing."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-medium">
                    <th className="py-2.5 px-4 font-mono">Invoice #</th>
                    <th className="py-2.5 px-4">Subscriber</th>
                    <th className="py-2.5 px-4">Cycle Month</th>
                    <th className="py-2.5 px-4">Overdue Days</th>
                    <th className="py-2.5 px-4">Aging Tier</th>
                    <th className="py-2.5 px-4 text-right">Amount Due</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRows.map((inv) => {
                    const cfg = BUCKET_CONFIG[inv.bucket || "current"] || BUCKET_CONFIG.current;

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                          <Link href={`/external-invoices`} className="hover:underline hover:text-primary">
                            #{inv.id}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                              {(inv.fullName || inv.username).slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{inv.fullName || inv.username}</div>
                              {inv.fullName && (
                                <div className="font-mono text-[10px] text-muted-foreground">{inv.username}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {inv.billingMonth ? inv.billingMonth.slice(0, 7) : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={cn(
                              "font-semibold",
                              inv.overdueDays > 60
                                ? "text-rose-600 dark:text-rose-400"
                                : inv.overdueDays > 30
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            )}
                          >
                            {inv.overdueDays} days
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", cfg.badge)}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-foreground">
                          ${Number(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" asChild>
                              <Link href={`/external-invoices`}>
                                <span>Pay / Collect</span>
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" asChild>
                              <Link href={`/users/details/${encodeURIComponent(inv.username)}`}>
                                <User className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
