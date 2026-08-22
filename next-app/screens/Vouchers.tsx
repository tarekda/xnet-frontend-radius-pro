"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ticket,
  Plus,
  Printer,
  KeyRound,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Layers,
  Sparkles,
  Ban,
  Filter,
  Eye,
  CreditCard,
  QrCode,
  Download,
  Copy,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { notify } from "@/lib/notify";
import { apiClient } from "@/api/client";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";

export interface VoucherBatch {
  id: string;
  name: string;
  profileId: number;
  profileName: string;
  quantity: number;
  durationDays: number;
  price: number;
  currency: string;
  prefix: string;
  createdBy: string;
  createdAt: string;
  totalCount: number;
  usedCount: number;
  status: "active" | "expired" | "depleted";
}

export interface VoucherCard {
  id: string;
  batchId: string;
  serialNumber: string;
  pinCode: string;
  profileId: number;
  profileName: string;
  durationDays: number;
  price: number;
  currency: string;
  status: "unused" | "used" | "revoked" | "expired";
  usedByUsername?: string;
  usedAt?: string;
  createdAt: string;
}

export default function Vouchers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data?.data ?? [];

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create batch form state
  const [batchName, setBatchName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [quantity, setQuantity] = useState("25");
  const [durationDays, setDurationDays] = useState("30");
  const [price, setPrice] = useState("15.00");
  const [prefix, setPrefix] = useState("XNET");

  // Redeem form state
  const [redeemPin, setRedeemPin] = useState("");
  const [redeemUsername, setRedeemUsername] = useState("");

  // Batches Query
  const batchesQuery = useQuery({
    queryKey: ["vouchers", "batches"],
    queryFn: async (): Promise<VoucherBatch[]> => {
      try {
        const { data } = await apiClient.get("/vouchers/batches");
        return data?.data ?? [];
      } catch {
        return [];
      }
    },
  });

  const batches = batchesQuery.data ?? [];

  // Auto-select first batch if none selected
  React.useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Selected Batch Cards Query
  const cardsQuery = useQuery({
    queryKey: ["vouchers", "cards", selectedBatchId, searchQuery, statusFilter],
    queryFn: async (): Promise<{ batch: VoucherBatch; cards: VoucherCard[] } | null> => {
      if (!selectedBatchId) return null;
      try {
        const { data } = await apiClient.get(`/vouchers/batches/${selectedBatchId}`, {
          params: { search: searchQuery, status: statusFilter },
        });
        return data?.data ?? null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(selectedBatchId),
  });

  const currentBatch = cardsQuery.data?.batch || batches.find((b) => b.id === selectedBatchId);
  const currentCards = cardsQuery.data?.cards ?? [];

  // Metrics Query
  const metricsQuery = useQuery({
    queryKey: ["vouchers", "metrics"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/vouchers/metrics");
        return data?.data ?? null;
      } catch {
        return null;
      }
    },
  });

  const metrics = metricsQuery.data;

  // Create Batch Mutation
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      const targetProfile = profiles.find((p) => String(p.id) === selectedProfileId);
      return apiClient.post("/vouchers/batches", {
        name: batchName.trim() || undefined,
        profileId: Number(selectedProfileId),
        profileName: targetProfile?.profileName || "Custom Plan",
        quantity: Number(quantity),
        durationDays: Number(durationDays),
        price: Number(price),
        currency: "USD",
        prefix: prefix.trim() || "XNET",
      });
    },
    onSuccess: (resp) => {
      notify.success("Batch Created", "Voucher cards generated successfully.");
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      if (resp?.data?.data?.batch?.id) {
        setSelectedBatchId(resp.data.data.batch.id);
      }
    },
    onError: (err: any) => notify.error("Create Failed", err?.response?.data?.message || err?.message),
  });

  // Redeem Mutation
  const redeemMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post("/vouchers/redeem", {
        pinCode: redeemPin.trim(),
        username: redeemUsername.trim(),
      });
    },
    onSuccess: (resp) => {
      notify.success("Voucher Redeemed", resp?.data?.message || "Subscriber account renewed.");
      setIsRedeemOpen(false);
      setRedeemPin("");
      setRedeemUsername("");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => notify.error("Redemption Failed", err?.response?.data?.message || err?.message),
  });

  // Revoke Card Mutation
  const revokeMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return apiClient.post(`/vouchers/cards/${cardId}/revoke`);
    },
    onSuccess: () => {
      notify.success("Revoked", "Voucher card has been cancelled.");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
    },
    onError: (err: any) => notify.error("Revoke Failed", err?.response?.data?.message || err?.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => notify.success("Copied", `${label} copied to clipboard`),
      () => notify.error("Copy failed", "Could not copy")
    );
  };

  const handlePrintBatch = () => {
    if (!selectedBatchId) return;
    window.open(`/vouchers/${selectedBatchId}/print`, "_blank");
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Prepaid Vouchers & Scratch Cards"
        subtitle="Batch generate retail scratch cards, printable voucher sheets, and instant subscriber redemption"
        icon={Ticket}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsRedeemOpen(true)}
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
            >
              <KeyRound className="h-4 w-4" />
              Redeem Voucher
            </Button>
            <Button
              onClick={() => {
                if (profiles.length > 0 && !selectedProfileId) {
                  setSelectedProfileId(String(profiles[0].id));
                }
                setIsCreateOpen(true);
              }}
              className="gap-2 bg-primary text-primary-foreground shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Generate Batch
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Batches</div>
              <div className="text-2xl font-bold mt-1">{metrics?.totalBatches ?? batches.length}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Active Campaigns</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Cards Generated</div>
              <div className="text-2xl font-bold mt-1">{metrics?.totalCards ?? 0}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {metrics?.unusedCards ?? 0} Available for sale
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Ticket className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Redemption Rate</div>
              <div className="text-2xl font-bold mt-1">{metrics?.redemptionRate ?? "0%"}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                {metrics?.usedCards ?? 0} Redeemed
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Generated Value</div>
              <div className="text-2xl font-bold mt-1">
                ${Number(metrics?.totalGeneratedVal ?? 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                ${Number(metrics?.redeemedVal ?? 0).toFixed(2)} Collected
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Batches list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-foreground">Voucher Batches</h3>
            <Badge variant="outline" className="text-xs">
              {batches.length} {batches.length === 1 ? "batch" : "batches"}
            </Badge>
          </div>

          <div className="space-y-2">
            {batches.length === 0 ? (
              <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
                No voucher batches found. Click &quot;Generate Batch&quot; to create your first set!
              </Card>
            ) : (
              batches.map((b) => {
                const isSelected = b.id === selectedBatchId;
                const pct = b.totalCount > 0 ? Math.round((b.usedCount / b.totalCount) * 100) : 0;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBatchId(b.id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/40"
                        : "bg-card hover:bg-muted/40 border-border/70 shadow-2xs hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm truncate">{b.name}</div>
                      <Badge
                        variant="outline"
                        className={
                          b.status === "depleted"
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                        }
                      >
                        {b.status === "depleted" ? "Depleted" : "Active"}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                      <span>Plan: {b.profileName}</span>
                      <span className="font-semibold text-foreground">${Number(b.price).toFixed(2)}</span>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Redeemed: {b.usedCount} / {b.totalCount}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Cards Table & Details */}
        <div className="lg:col-span-8 space-y-4">
          {currentBatch ? (
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="border-b border-border/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{currentBatch.name}</CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {currentBatch.id}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Plan: <span className="font-semibold text-foreground">{currentBatch.profileName}</span> • Validity:{" "}
                    <span className="font-semibold text-foreground">{currentBatch.durationDays} Days</span> • Price:{" "}
                    <span className="font-semibold text-foreground">${Number(currentBatch.price).toFixed(2)}</span>
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintBatch}
                    className="gap-1.5 shadow-xs border-primary/30 text-primary hover:bg-primary/10"
                    title="Print scratch card sheet"
                  >
                    <Printer className="h-4 w-4" />
                    Print Sheet
                  </Button>
                </div>
              </CardHeader>

              {/* Filters */}
              <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-wrap gap-2 items-center justify-between">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by PIN or Serial Number…"
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="unused">Unused (Available)</SelectItem>
                    <SelectItem value="used">Redeemed</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>PIN Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Redeemed By</TableHead>
                        <TableHead>Redeemed Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCards.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                            No cards matching filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentCards.map((card) => (
                          <TableRow key={card.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span>{card.serialNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(card.serialNumber, "Serial Number")}
                                  className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-muted/80 px-2 py-0.5 rounded border font-bold text-primary">
                                  {card.pinCode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(card.pinCode, "PIN Code")}
                                  className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  card.status === "used"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                                    : card.status === "revoked"
                                      ? "bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]"
                                }
                              >
                                {card.status === "used" ? "Redeemed" : card.status === "revoked" ? "Revoked" : "Unused"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {card.usedByUsername ? (
                                <span className="text-foreground">{card.usedByUsername}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {card.usedAt ? new Date(card.usedAt).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {card.status === "unused" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => revokeMutation.mutate(card.id)}
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  title="Revoke card"
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  Revoke
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground border-dashed">
              Select or create a voucher batch on the left to view cards.
            </Card>
          )}
        </div>
      </div>

      {/* Modal 1: Generate Voucher Batch */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Generate Voucher Batch</DialogTitle>
            <DialogDescription>
              Create a batch of printable scratch cards with secure randomized PINs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Batch Name / Campaign</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Summer Promo 2026"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subscription Plan</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target plan" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.profileName} (${p.monthlyQuota ? `${p.monthlyQuota}GB` : "Unlimited"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantity of Cards</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Validity (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Retail Price ($ USD)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Serial Prefix</Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder="XNET"
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createBatchMutation.mutate()}
              disabled={createBatchMutation.isPending || !selectedProfileId}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {createBatchMutation.isPending ? "Generating Cards…" : "Generate Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Quick Redeem Voucher */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Redeem Voucher
            </DialogTitle>
            <DialogDescription>
              Enter subscriber username and scratch card PIN to instantly renew access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subscriber Username</Label>
              <Input
                value={redeemUsername}
                onChange={(e) => setRedeemUsername(e.target.value)}
                placeholder="e.g. user_1092"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Voucher PIN Code</Label>
              <Input
                value={redeemPin}
                onChange={(e) => setRedeemPin(e.target.value.toUpperCase())}
                placeholder="e.g. 7482-9381-0293"
                className="font-mono text-center text-base tracking-wider font-bold"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the 12-digit alphanumeric code from the card.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRedeemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => redeemMutation.mutate()}
              disabled={redeemMutation.isPending || !redeemPin.trim() || !redeemUsername.trim()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              {redeemMutation.isPending ? "Redeeming…" : "Apply & Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
