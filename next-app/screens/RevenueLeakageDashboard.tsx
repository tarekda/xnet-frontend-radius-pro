"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  Ghost,
  DollarSign,
  AlertTriangle,
  Zap,
  CheckCircle2,
  RefreshCw,
  Search,
  PowerOff,
  Activity,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface LeakageAuditRecord {
  id: number;
  username: string;
  fullName: string | null;
  nasIp: string | null;
  nasIdentifier: string | null;
  callerId: string | null;
  framedIp: string | null;
  leakType: "EXPIRED_UNPAID_ONLINE" | "GHOST_STALE_SESSION" | "PROFILE_SPEED_MISALIGNMENT";
  leakReason: string;
  bytesIn: string;
  bytesOut: string;
  unpaidInvoiceId: number | null;
  unpaidAmount: string | null;
  estimatedLossUsd: string;
  remediationAction: string;
  status: "detected" | "remediated" | "ignored" | "false_positive";
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

interface LeakageSummary {
  activeGhostCount: number;
  unpaidOnlineCount: number;
  speedMisalignmentCount: number;
  totalActiveLeaks: number;
  totalEstimatedLossUsd: number;
  remediatedCount: number;
  lastAuditAt: string | null;
}

function formatBytes(bytesStr: string | number | bigint): string {
  const bytes = Number(bytesStr || 0);
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function RevenueLeakageDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("detected");
  const [remediateAllOpen, setRemediateAllOpen] = useState(false);

  // 1. Fetch Executive Summary KPIs
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery<LeakageSummary>({
    queryKey: ["revenueLeakageSummary"],
    queryFn: async () => {
      const res = await apiClient.get("/revenue-leakage/summary");
      return res.data?.data;
    },
    refetchInterval: 15000,
  });

  // 2. Fetch Audit Records List
  const {
    data: auditsData,
    isLoading: isAuditsLoading,
    isFetching: isAuditsFetching,
    refetch: refetchAudits,
  } = useQuery<any>({
    queryKey: ["revenueLeakageAudits", typeFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const res = await apiClient.get("/revenue-leakage/audits", {
        params: {
          leakType: typeFilter === "ALL" ? undefined : typeFilter,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
          limit: 100,
        },
      });
      const raw = res.data;
      if (Array.isArray(raw?.records)) return raw.records;
      if (Array.isArray(raw?.data)) return raw.data;
      if (Array.isArray(raw)) return raw;
      return [];
    },
    refetchInterval: 20000,
  });

  // 3. Mutation: Run Network Audit Now
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/revenue-leakage/run-audit", {
        autoRemediate: false,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageSummary"] });
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageAudits"] });
      toast({
        title: "Network Audit Completed",
        description: `Inspected ${data?.totalInspected || 0} active sessions. Found ${
          data?.leaksDetected || 0
        } leaks ($${data?.totalEstimatedLossUsd || 0} at risk).`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Audit Execution Failed",
        description: err?.response?.data?.message || err?.message || "Failed to run audit.",
        variant: "destructive",
      });
    },
  });

  // 4. Mutation: Remediate Single Leak
  const remediateSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post(`/revenue-leakage/remediate/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageSummary"] });
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageAudits"] });
      toast({
        title: "Leak Plugged",
        description: `Session disconnected via MikroTik API & CoA PoD.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Remediation Failed",
        description: err?.response?.data?.message || err?.message || "Could not terminate session.",
        variant: "destructive",
      });
    },
  });

  // 5. Mutation: Plug All Leaks (1-Click Remediation)
  const remediateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/revenue-leakage/remediate-all");
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageSummary"] });
      queryClient.invalidateQueries({ queryKey: ["revenueLeakageAudits"] });
      toast({
        title: "1-Click Remediation Complete",
        description: `Plugged ${data?.remediated || 0} rogue sessions (${data?.failed || 0} failed).`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Bulk Remediation Failed",
        description: err?.response?.data?.message || err?.message || "Error running bulk remediation.",
        variant: "destructive",
      });
    },
  });

  const records: LeakageAuditRecord[] = useMemo(() => {
    if (!auditsData) return [];
    if (Array.isArray(auditsData)) return auditsData;
    if (Array.isArray(auditsData.records)) return auditsData.records;
    if (Array.isArray(auditsData.data)) return auditsData.data;
    return [];
  }, [auditsData]);

  const applyKpiFilter = (type: string, status: string) => {
    setTypeFilter(type);
    setStatusFilter(status);
  };

  const handleKpiKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    type: string,
    status: string
  ) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      applyKpiFilter(type, status);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Revenue Leakage & Ghost Session Audit"
        subtitle="Autonomous cross-reconciliation of live MikroTik hardware sessions against FreeRADIUS accounting and billing invoices."
        icon={ShieldAlert}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchSummary();
                refetchAudits();
              }}
              disabled={isAuditsFetching}
              className="flex items-center gap-2 border-border/80 shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 ${isAuditsFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => runAuditMutation.mutate()}
              disabled={runAuditMutation.isPending}
              className="flex items-center gap-2 border-indigo-500/30 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-300 shadow-xs"
            >
              <Activity className={`h-4 w-4 ${runAuditMutation.isPending ? "animate-spin" : ""}`} />
              {runAuditMutation.isPending ? "Auditing Network..." : "Run Audit Now"}
            </Button>

            <Button
              size="sm"
              onClick={() => setRemediateAllOpen(true)}
              disabled={remediateAllMutation.isPending || (summary?.totalActiveLeaks || 0) === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-500/20"
            >
              <PowerOff className="h-4 w-4" />
              {remediateAllMutation.isPending ? "Plugging Leaks..." : "Plug All Leaks"}
            </Button>
          </div>
        }
      />

      {isSummaryError && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to load the revenue leakage summary.
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards Grid (Clickable to Filter Table) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Revenue at Risk */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => applyKpiFilter("ALL", "detected")}
          onKeyDown={(e) => handleKpiKeyDown(e, "ALL", "detected")}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            typeFilter === "ALL" && statusFilter === "detected" ? "ring-2 ring-rose-500 shadow-sm" : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Revenue at Risk
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                `$${(Number(summary?.totalEstimatedLossUsd) || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
              <span>Unpaid bandwidth consumption</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Ghost Sessions */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => applyKpiFilter("GHOST_STALE_SESSION", "detected")}
          onKeyDown={(e) => handleKpiKeyDown(e, "GHOST_STALE_SESSION", "detected")}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            typeFilter === "GHOST_STALE_SESSION" ? "ring-2 ring-purple-500 shadow-sm" : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Ghost Sessions
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Ghost className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
              {isSummaryLoading ? <Skeleton className="h-7 w-12" /> : summary?.activeGhostCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Router online, missing in radacct
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Expired / Overdue Online */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => applyKpiFilter("EXPIRED_UNPAID_ONLINE", "detected")}
          onKeyDown={(e) => handleKpiKeyDown(e, "EXPIRED_UNPAID_ONLINE", "detected")}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            typeFilter === "EXPIRED_UNPAID_ONLINE" ? "ring-2 ring-amber-500 shadow-sm" : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Expired & Overdue
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
              {isSummaryLoading ? <Skeleton className="h-7 w-12" /> : summary?.unpaidOnlineCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Past-due subscribers browsing
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Speed Profile Misalignment */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => applyKpiFilter("PROFILE_SPEED_MISALIGNMENT", "detected")}
          onKeyDown={(e) => handleKpiKeyDown(e, "PROFILE_SPEED_MISALIGNMENT", "detected")}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            typeFilter === "PROFILE_SPEED_MISALIGNMENT" ? "ring-2 ring-blue-500 shadow-sm" : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Speed Misaligned
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
              {isSummaryLoading ? <Skeleton className="h-7 w-12" /> : summary?.speedMisalignmentCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              DB throttled, full speed on router
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Remediated Leaks */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => applyKpiFilter("ALL", "remediated")}
          onKeyDown={(e) => handleKpiKeyDown(e, "ALL", "remediated")}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            statusFilter === "remediated" ? "ring-2 ring-emerald-500 shadow-sm" : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Plugged Leaks
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {isSummaryLoading ? <Skeleton className="h-7 w-12" /> : summary?.remediatedCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Successfully disconnected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search username, IP, or MAC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 h-9"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[190px] h-9 text-xs">
                <SelectValue placeholder="All Leak Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Leak Types</SelectItem>
                <SelectItem value="EXPIRED_UNPAID_ONLINE">Expired & Overdue</SelectItem>
                <SelectItem value="GHOST_STALE_SESSION">Ghost Sessions</SelectItem>
                <SelectItem value="PROFILE_SPEED_MISALIGNMENT">Speed Misalignment</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detected">Active Leaks Only</SelectItem>
                <SelectItem value="remediated">Remediated</SelectItem>
                <SelectItem value="ALL">All Statuses</SelectItem>
              </SelectContent>
            </Select>

            {(typeFilter !== "ALL" || statusFilter !== "detected" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setTypeFilter("ALL");
                  setStatusFilter("detected");
                  setSearchQuery("");
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
            <span>Showing {records.length} discrepancies</span>
            {summary?.lastAuditAt && (
              <span className="text-[11px] opacity-75">
                (Last audit: {new Date(summary.lastAuditAt).toLocaleTimeString()})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Discrepancies Table */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[180px]">Subscriber</TableHead>
                <TableHead className="w-[160px]">Leak Type</TableHead>
                <TableHead className="min-w-[280px]">Reason & Evidence</TableHead>
                <TableHead className="w-[140px]">Network Info</TableHead>
                <TableHead className="w-[120px]">Bandwidth</TableHead>
                <TableHead className="w-[110px] text-right">Est. Loss</TableHead>
                <TableHead className="w-[110px] text-center">Status</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAuditsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Analyzing network telemetry and cross-reconciling sessions...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    {typeFilter !== "ALL" || searchQuery || statusFilter !== "detected" ? (
                      <div className="space-y-2">
                        <Filter className="h-10 w-10 mx-auto text-muted-foreground/50" />
                        <div className="font-semibold text-foreground">No Discrepancies Match Filter</div>
                        <div className="text-xs max-w-md mx-auto text-muted-foreground">
                          No records currently match type <span className="font-mono font-semibold">{typeFilter}</span> with status <span className="font-mono font-semibold">{statusFilter}</span>.
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => {
                            setTypeFilter("ALL");
                            setStatusFilter("detected");
                            setSearchQuery("");
                          }}
                        >
                          View All Active Leaks
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-emerald-500/60" />
                        <div className="font-semibold text-foreground">No Revenue Leaks Detected</div>
                        <div className="text-xs max-w-md mx-auto mt-1">
                          All live MikroTik sessions are synchronized with FreeRADIUS accounting and have active, paid billing records.
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                records.map((rec) => {
                  const isGhost = rec.leakType === "GHOST_STALE_SESSION";
                  const isOverdue = rec.leakType === "EXPIRED_UNPAID_ONLINE";
                  const isMisaligned = rec.leakType === "PROFILE_SPEED_MISALIGNMENT";
                  const isRemediated = rec.status === "remediated";
                  const loss = Number(rec.estimatedLossUsd || 0);

                  return (
                    <TableRow
                      key={rec.id}
                      className={
                        !isRemediated
                          ? "bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40 dark:hover:bg-rose-950/20"
                          : ""
                      }
                    >
                      {/* Subscriber */}
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">{rec.username}</div>
                        {rec.fullName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[170px]">
                            {rec.fullName}
                          </div>
                        )}
                      </TableCell>

                      {/* Leak Type */}
                      <TableCell>
                        {isGhost && (
                          <Badge
                            variant="outline"
                            className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 text-[11px]"
                          >
                            <Ghost className="h-3 w-3" />
                            Ghost Session
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px]"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Expired / Overdue
                          </Badge>
                        )}
                        {isMisaligned && (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px]"
                          >
                            <Zap className="h-3 w-3" />
                            Speed Mismatch
                          </Badge>
                        )}
                      </TableCell>

                      {/* Reason & Evidence */}
                      <TableCell>
                        <div className="text-xs leading-relaxed text-foreground/90">
                          {rec.leakReason}
                        </div>
                        {rec.unpaidInvoiceId && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                            Invoice #{rec.unpaidInvoiceId} (${rec.unpaidAmount || "—"})
                          </div>
                        )}
                      </TableCell>

                      {/* Network Info */}
                      <TableCell>
                        <div className="text-xs font-mono text-foreground/80">
                          {rec.framedIp || "—"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[130px]">
                          {rec.callerId || rec.nasIp || "—"}
                        </div>
                      </TableCell>

                      {/* Bandwidth */}
                      <TableCell>
                        <div className="text-xs font-medium">
                          {formatBytes(BigInt(rec.bytesIn || 0) + BigInt(rec.bytesOut || 0))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          ↓ {formatBytes(rec.bytesIn)} ↑ {formatBytes(rec.bytesOut)}
                        </div>
                      </TableCell>

                      {/* Estimated Loss */}
                      <TableCell className="text-right">
                        <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                          ${loss.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {isRemediated ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Plugged
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                            Active Leak
                          </span>
                        )}
                      </TableCell>

                      {/* Remediation Action */}
                      <TableCell className="text-right">
                        {isRemediated ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            Resolved
                          </span>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs px-2.5 font-medium shadow-2xs"
                            onClick={() => remediateSingleMutation.mutate(rec.id)}
                            disabled={remediateSingleMutation.isPending}
                          >
                            <PowerOff className="h-3 w-3 mr-1" />
                            Plug Leak
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={remediateAllOpen} onOpenChange={setRemediateAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to terminate ALL detected ghost and unpaid sessions on MikroTik?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                remediateAllMutation.mutate();
                setRemediateAllOpen(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
