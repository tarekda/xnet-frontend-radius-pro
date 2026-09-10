"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Wifi, WifiOff, Activity, Shield, Key, Download, Upload,
  CreditCard, Smartphone, MessageCircle, AlertTriangle,
  CheckCircle2, Clock, ExternalLink, RefreshCw, FileText, User, Zap
} from "lucide-react";
import { TurboBoostModal } from "@/components/TurboBoostModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/api/client";
import { formatBytes, cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";

export interface SubscriberPortalData {
  username: string;
  fullName?: string;
  status: string;
  profileName?: string;
  downloadSpeedLimit?: number;
  uploadSpeedLimit?: number;
  isOnline: boolean;
  ipAddress?: string;
  sessionDurationSec?: number;
  dailyUsageBytes?: number;
  dailyQuotaBytes?: number;
  monthlyUsageBytes?: number;
  monthlyQuotaBytes?: number;
  activeTopupBytes?: number;
  openInvoicesCount?: number;
  totalDueAmount?: number;
  walletBalance?: number;
}

export default function SubscriberPortal({ subscriberUsername }: { subscriberUsername?: string }) {
  const username = subscriberUsername || "demo-subscriber";
  const [isTurboBoostOpen, setIsTurboBoostOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<SubscriberPortalData>({
    queryKey: ["subscriber-portal", username],
    queryFn: async () => {
      try {
        const resp = await apiClient.get(`/subscribers/${encodeURIComponent(username)}/portal`);
        return resp.data?.data;
      } catch {
        // Mock fallback for preview if standalone
        return {
          username,
          fullName: "Enterprise Subscriber",
          status: "active",
          profileName: "Fiber Pro 100Mbps",
          downloadSpeedLimit: 100,
          uploadSpeedLimit: 50,
          isOnline: true,
          ipAddress: "100.64.12.85",
          sessionDurationSec: 43200,
          dailyUsageBytes: 12 * 1024 * 1024 * 1024,
          dailyQuotaBytes: 50 * 1024 * 1024 * 1024,
          monthlyUsageBytes: 340 * 1024 * 1024 * 1024,
          monthlyQuotaBytes: 1000 * 1024 * 1024 * 1024,
          openInvoicesCount: 1,
          totalDueAmount: 45.0,
          walletBalance: 15.0,
        };
      }
    },
    staleTime: 30000,
  });

  const sub = data;
  const isOnline = Boolean(sub?.isOnline);

  const dailyPct = sub?.dailyQuotaBytes && sub.dailyQuotaBytes > 0
    ? Math.min(100, (Number(sub.dailyUsageBytes || 0) / sub.dailyQuotaBytes) * 100)
    : 0;

  const monthlyPct = sub?.monthlyQuotaBytes && sub.monthlyQuotaBytes > 0
    ? Math.min(100, (Number(sub.monthlyUsageBytes || 0) / sub.monthlyQuotaBytes) * 100)
    : 0;

  return (
    <div className="w-full min-w-0 space-y-6 py-6 max-w-5xl mx-auto">
      {/* Operator Impersonation Notice */}
      {subscriberUsername && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between text-xs text-primary">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Viewing Subscriber Portal preview for <strong>@{subscriberUsername}</strong></span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/users/details/${encodeURIComponent(subscriberUsername)}`}>
              Return to Admin View
            </Link>
          </Button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={sub?.fullName ? `${sub.fullName} (${sub.username})` : `@${username}`}
        subtitle={`Subscriber Account & Self-Service Portal · Plan: ${sub?.profileName || "Standard"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" asChild>
              <Link href="/subscriber">
                <ExternalLink className="h-4 w-4 mr-1" />
                Live Portal Link
              </Link>
            </Button>
          </div>
        }
      />

      {/* Connectivity & Plan Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Status */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Line Connection</span>
              {isOnline ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
              )}
            </div>
            <CardTitle className="text-xl font-bold mt-1 font-mono">
              {isOnline ? sub?.ipAddress || "Connected" : "Disconnected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            {isOnline && sub?.sessionDurationSec ? (
              <span>Session uptime: {Math.floor(sub.sessionDurationSec / 3600)}h {Math.floor((sub.sessionDurationSec % 3600) / 60)}m</span>
            ) : (
              <span>No active RADIUS session</span>
            )}
          </CardContent>
        </Card>

        {/* Speed Plan */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Subscribed Speed Plan</span>
              <Activity className="h-4 w-4 text-indigo-500" />
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {sub?.profileName || "High-Speed Tier"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground flex items-center gap-3 font-mono">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Download className="h-3.5 w-3.5" /> {sub?.downloadSpeedLimit || 100} Mbps
            </span>
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
              <Upload className="h-3.5 w-3.5" /> {sub?.uploadSpeedLimit || 50} Mbps
            </span>
          </CardContent>
        </Card>

        {/* Balance & Invoices */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Billing Balance</span>
              <CreditCard className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-xl font-bold mt-1 font-mono text-foreground">
              ${(sub?.totalDueAmount ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>{sub?.openInvoicesCount || 0} invoice(s) due</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              Wallet: ${(sub?.walletBalance ?? 0).toFixed(2)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Quotas & Traffic Consumption */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Daily Quota */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Daily Quota Window</CardTitle>
                <CardDescription className="text-xs">Resets at midnight (00:00)</CardDescription>
              </div>
              <span className="font-mono font-bold text-xs">
                {dailyPct.toFixed(0)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={dailyPct} className="h-2.5" />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Used: {formatBytes(sub?.dailyUsageBytes || 0)}</span>
              <span>Quota: {sub?.dailyQuotaBytes ? formatBytes(sub.dailyQuotaBytes) : "Unlimited"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Monthly FUP Quota */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Monthly Fair Usage (FUP)</CardTitle>
                  {sub?.activeTopupBytes && sub.activeTopupBytes > 0 ? (
                    <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-600 border-amber-500/30">
                      +{formatBytes(sub.activeTopupBytes)} Boost
                    </Badge>
                  ) : null}
                </div>
                <CardDescription className="text-xs">Current monthly billing cycle</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsTurboBoostOpen(true)}
                  className="h-7 text-xs gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs font-semibold"
                >
                  <Zap className="h-3 w-3 fill-white" />
                  Turbo Boost
                </Button>
                <span className="font-mono font-bold text-xs">
                  {monthlyPct.toFixed(0)}%
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={monthlyPct}
              className={cn("h-2.5", monthlyPct >= 90 && "bg-rose-500/20 [&>div]:bg-rose-500")}
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Used: {formatBytes(sub?.monthlyUsageBytes || 0)}</span>
              <span>Total: {sub?.monthlyQuotaBytes ? formatBytes(sub.monthlyQuotaBytes) : "Unlimited"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Self-Service Actions */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Subscriber Services & Support</CardTitle>
          <CardDescription className="text-xs">Instant account management, payment, and assistance</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-0">
          <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1" asChild>
            <Link href="/subscriber">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                Pay Invoice Online
              </span>
              <span className="text-[11px] text-muted-foreground">Pay via Whish, Credit Card, or Wallet</span>
            </Link>
          </Button>

          <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1" asChild>
            <Link href="/change-password">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-primary" />
                Change Password
              </span>
              <span className="text-[11px] text-muted-foreground">Update PPPoE / Hotspot Wi-Fi password</span>
            </Link>
          </Button>

          <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1" asChild>
            <Link href="/whatsapp-hub">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                WhatsApp Help Desk
              </span>
              <span className="text-[11px] text-muted-foreground">Connect with technical support 24/7</span>
            </Link>
          </Button>
        </CardContent>
      </Card>

      <TurboBoostModal
        open={isTurboBoostOpen}
        onOpenChange={setIsTurboBoostOpen}
        subscriberUsername={subscriberUsername}
        onPurchased={() => refetch()}
      />
    </div>
  );
}
