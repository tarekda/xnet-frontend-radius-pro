"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Alert from "@/components/ui/Alert";
import {
  Wifi,
  Lock,
  User,
  LogOut,
  RefreshCw,
  CreditCard,
  CalendarClock,
  Activity,
  CheckCircle2,
  Loader2,
  Smartphone,
  Receipt,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  Ticket,
} from "lucide-react";

const API_BASE =
  (typeof window !== "undefined" && (window as any).__ENV__?.NEXT_PUBLIC_API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "/api";

/** Whish consumer docs: payment links are opened/approved in the Whish app. */
const WHISH_ADD_TRANSFER_URL = "https://www.whish.money/add-transfer";
const WHISH_GET_APP_URL = "https://apps.whish.money/whish-app";

function storageKey(k: string) {
  return `subscriber.${k}`;
}

function formatBytes(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x < 10 && i > 0 ? x.toFixed(1) : Math.round(x)} ${units[i]}`;
}

function formatMoney(amount: number | string | null | undefined, currency = "USD"): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "LBP" ? "LBP" : "USD",
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonth(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function usagePct(used: number, quota: number): number {
  if (!quota || quota <= 0) return 0;
  return Math.min(100, Math.round((used / quota) * 100));
}

function statusVariant(
  status: string | null | undefined
): "success" | "destructive" | "secondary" | "outline" {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "paid") return "success";
  if (s === "expired" || s === "disabled" || s === "overdue") return "destructive";
  if (s === "unpaid" || s === "pending") return "outline";
  return "secondary";
}

type PaymentProviderInfo = {
  provider: "stub" | "whish" | string;
  whishConfigured: boolean;
  currency: string;
  qrEnabled?: boolean;
  qrImageUrl?: string | null;
  qrLabel?: string;
  qrHint?: string;
  qrDeepLink?: string | null;
};

function SubscriberPortalContent() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [walletLedger, setWalletLedger] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [provider, setProvider] = useState<PaymentProviderInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [walletPayingId, setWalletPayingId] = useState<number | null>(null);
  const [paySheet, setPaySheet] = useState<{
    invoiceId: number;
    amountLabel: string;
    amountValue: number;
    checkoutUrl: string | null;
    provider: string;
    mode: "qr" | "link" | "both";
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrBroken, setQrBroken] = useState(false);
  const [whishReference, setWhishReference] = useState("");
  const [reportAmount, setReportAmount] = useState("");
  const [reporting, setReporting] = useState(false);
  const [voucherPin, setVoucherPin] = useState("");
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [isBuyVoucherOpen, setIsBuyVoucherOpen] = useState(false);
  const [voucherPlans, setVoucherPlans] = useState<Array<{
    id: number;
    profileName: string;
    price: number;
    durationDays: number;
    monthlyQuotaGB?: number | null;
    speedDownMbps?: number | null;
    speedUpMbps?: number | null;
  }>>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [buyingVoucher, setBuyingVoucher] = useState(false);

  const openBuyVoucherModal = async () => {
    setIsBuyVoucherOpen(true);
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/subscriber/voucher-plans`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setVoucherPlans(json.data || []);
        if (json.data && json.data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(json.data[0].id);
        }
      }
    } catch {
      // Ignore fetch error
    }
  };

  const handleBuyVoucher = async () => {
    if (!selectedPlanId || !headers) return;
    setBuyingVoucher(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/subscriber/buy-voucher`, {
        method: "POST",
        headers,
        body: JSON.stringify({ profileId: selectedPlanId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to purchase voucher");
      setIsBuyVoucherOpen(false);
      setNotice(json.message || "Voucher purchased and line renewed!");
      if (token) void load(token);
    } catch (err: any) {
      setError(err?.message || "Failed to purchase voucher");
    } finally {
      setBuyingVoucher(false);
    }
  };

  const redeemVoucher = async (e: FormEvent) => {
    e.preventDefault();
    const pin = voucherPin.trim();
    if (!pin || !headers) return;
    setRedeemingVoucher(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/subscriber/redeem-voucher`, {
        method: "POST",
        headers,
        body: JSON.stringify({ pinCode: pin }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Voucher redemption failed");
      setVoucherPin("");
      setNotice(json.message || "Voucher redeemed successfully! Your account has been renewed.");
      if (token) void load(token);
    } catch (err: any) {
      setError(err?.message || "Failed to redeem voucher PIN");
    } finally {
      setRedeemingVoucher(false);
    }
  };

  useEffect(() => {
    const t = sessionStorage.getItem(storageKey("accessToken"));
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    const paid = searchParams.get("paid");
    if (paid === "1") {
      setNotice(
        "If you completed payment in Whish, your invoice will update shortly. Refresh if needed."
      );
    } else if (paid === "0") {
      setError("Payment was cancelled or failed. You can try again anytime.");
    }
  }, [searchParams]);

  const headers = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          }
        : undefined,
    [token]
  );

  const load = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const h = {
        Authorization: `Bearer ${accessToken}`,
        "X-Requested-With": "XMLHttpRequest",
      };
      const [meRes, usageRes, invRes, sessRes, payRes, ledgerRes] = await Promise.all([
        fetch(`${API_BASE}/subscriber/me`, { headers: h }),
        fetch(`${API_BASE}/subscriber/usage`, { headers: h }),
        fetch(`${API_BASE}/subscriber/invoices`, { headers: h }),
        fetch(`${API_BASE}/subscriber/sessions?limit=5`, { headers: h }),
        fetch(`${API_BASE}/subscriber/payment-provider`, { headers: h }),
        fetch(`${API_BASE}/subscriber/wallet/ledger?limit=20`, { headers: h }),
      ]);
      if (!meRes.ok) throw new Error("Session expired — please sign in again");
      setMe((await meRes.json()).data);
      setUsage((await usageRes.json()).data);
      setInvoices((await invRes.json()).data || []);
      const sessJson = await sessRes.json();
      setSessions(sessJson.data?.sessions || []);
      if (payRes.ok) {
        setProvider((await payRes.json()).data || null);
      }
      if (ledgerRes.ok) {
        const ledgerJson = await ledgerRes.json();
        setWalletLedger(ledgerJson.data || []);
      } else {
        setWalletLedger([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch(() => {
      setToken(null);
      sessionStorage.removeItem(storageKey("accessToken"));
      sessionStorage.removeItem(storageKey("refreshToken"));
    });
  }, [token, load]);

  const login = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/subscriber/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Login failed");
      sessionStorage.setItem(storageKey("accessToken"), json.data.accessToken);
      sessionStorage.setItem(storageKey("refreshToken"), json.data.refreshToken);
      setToken(json.data.accessToken);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const refresh = sessionStorage.getItem(storageKey("refreshToken"));
    try {
      if (refresh) {
        await fetch(`${API_BASE}/auth/subscriber/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ refreshToken: refresh }),
        });
      }
    } catch {
      /* ignore */
    }
    setToken(null);
    setMe(null);
    setUsage(null);
    setInvoices([]);
    setWalletLedger([]);
    setSessions([]);
    setProvider(null);
    sessionStorage.removeItem(storageKey("accessToken"));
    sessionStorage.removeItem(storageKey("refreshToken"));
  };

  const payWithWhish = async (inv: { id: number; totalAmount?: number; amount?: number }) => {
    if (!headers) return;
    setPayingId(inv.id);
    setError(null);
    setNotice(null);
    setCopied(false);
    setQrBroken(false);
    try {
      const amount = Number(inv.totalAmount ?? inv.amount ?? 0);
      const payCurrency = provider?.currency || "USD";
      const amountLabel = formatMoney(amount, payCurrency);
      const qrOn =
        provider?.qrEnabled === false
          ? false
          : Boolean(provider?.qrEnabled || provider?.qrImageUrl || true);
      const gatewayOn = Boolean(provider?.whishConfigured);

      // Static QR alone is enough — no gateway call required.
      if (qrOn && !gatewayOn) {
        setPaySheet({
          invoiceId: inv.id,
          amountLabel,
          amountValue: amount,
          checkoutUrl: null,
          provider: "whish-qr",
          mode: "qr",
        });
        setWhishReference("");
        setReportAmount(String(amount));
        return;
      }

      let checkoutUrl: string | null = null;
      let intentProvider = provider?.provider || "stub";
      try {
        const res = await fetch(`${API_BASE}/subscriber/invoices/${inv.id}/payment-intent`, {
          method: "POST",
          headers,
        });
        const json = await res.json();
        if (res.ok && json.success && json.data?.checkoutUrl) {
          checkoutUrl = json.data.checkoutUrl;
          intentProvider = String(json.data?.provider || json.data?.gatewayProvider || intentProvider);
        } else if (!qrOn) {
          throw new Error(json.message || "Could not start payment");
        }
      } catch (e: any) {
        if (!qrOn) throw e;
      }

      setPaySheet({
        invoiceId: inv.id,
        amountLabel,
        amountValue: amount,
        checkoutUrl,
        provider: intentProvider,
        mode: qrOn && checkoutUrl ? "both" : qrOn ? "qr" : "link",
      });
      setWhishReference("");
      setReportAmount(String(amount));
    } catch (err: any) {
      setError(err?.message || "Payment failed to start");
    } finally {
      setPayingId(null);
    }
  };

  const openWhishLink = () => {
    if (!paySheet?.checkoutUrl) return;
    window.open(paySheet.checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const openWhishDeepLink = () => {
    const url = provider?.qrDeepLink || "https://www.whish.money/add-transfer?id=71158661";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyWhishLink = async () => {
    const url = paySheet?.checkoutUrl || provider?.qrDeepLink || "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link — open it instead.");
    }
  };

  const finishPaySheet = () => {
    setPaySheet(null);
    setNotice("You can submit your Whish reference anytime from Top up via Whish.");
    if (token) void load(token);
  };

  const payFromWallet = async (inv: {
    id: number;
    totalAmount?: number;
    amount?: number;
    remainingDue?: number;
  }) => {
    if (!headers) return;
    const due = Number(inv.remainingDue ?? inv.totalAmount ?? inv.amount ?? 0);
    const bal = Number(me?.walletBalance ?? 0);
    if (bal + 1e-9 < 0.01) {
      setError("Wallet is empty — top up via Whish first.");
      return;
    }
    const willPartial = bal + 1e-9 < due;
    if (
      willPartial &&
      !window.confirm(
        `Your balance (${formatMoney(bal, provider?.currency || "USD")}) is less than the remaining due (${formatMoney(due, provider?.currency || "USD")}). Pay what you can now?`
      )
    ) {
      return;
    }
    setWalletPayingId(inv.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/subscriber/invoices/${inv.id}/pay-from-wallet`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Wallet payment failed");
      if (json.data?.partial) {
        setNotice(
          `Partial payment applied: ${formatMoney(json.data.amountApplied, currency)}. Remaining: ${formatMoney(json.data.remainingDue, currency)}.`
        );
      } else {
        setNotice(
          json.data?.renewed
            ? "Paid from wallet — account renewed."
            : "Invoice paid from your wallet balance."
        );
      }
      if (token) await load(token);
    } catch (err: any) {
      setError(err?.message || "Wallet payment failed");
    } finally {
      setWalletPayingId(null);
    }
  };

  const reportWhishPayment = async () => {
    if (!headers || !paySheet) return;
    setReporting(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/subscriber/invoices/${paySheet.invoiceId}/report-whish-payment`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            whishReference: whishReference.trim(),
            amount: Number(reportAmount || paySheet.amountValue),
            currency,
            note: me?.username ? `subscriber:${me.username}` : undefined,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Could not report payment");
      setPaySheet(null);
      setNotice(
        "Payment reported. After staff approve, the amount is credited to your wallet — then use Pay from wallet."
      );
      if (token) void load(token);
    } catch (err: any) {
      setError(err?.message || "Failed to report payment");
    } finally {
      setReporting(false);
    }
  };

  const unpaid = useMemo(
    () => invoices.filter((inv) => String(inv.status || "").toLowerCase() !== "paid"),
    [invoices]
  );
  const unpaidTotal = useMemo(
    () =>
      unpaid.reduce((sum, inv) => {
        const rem = Number(inv.remainingDue ?? inv.totalAmount ?? inv.amount ?? 0);
        return sum + (Number.isFinite(rem) ? rem : 0);
      }, 0),
    [unpaid]
  );
  const currency = provider?.currency || "USD";
  const whishReady = Boolean(provider?.whishConfigured || provider?.provider === "whish");
  // Prefer API flags; fall back so the static QR still shows if backend is stale.
  const qrImageUrl = provider?.qrImageUrl || "/whish-pay-qr.png";
  const qrDeepLink =
    provider?.qrDeepLink || "https://www.whish.money/add-transfer?id=71158661";
  const qrEnabled =
    provider?.qrEnabled === false
      ? false
      : Boolean(provider?.qrEnabled || qrImageUrl);
  const dailyPct = usagePct(usage?.dailyUsed, usage?.dailyQuota);
  const monthlyPct = usagePct(usage?.monthlyUsed, usage?.monthlyQuota);

  if (!token) {
    return (
      <div className="shop-app-shell flex min-h-full items-center justify-center overflow-y-auto p-4">
        <div className="w-full max-w-md space-y-5 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <Wifi className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Xnet</h1>
            <p className="text-sm text-muted-foreground">
              Subscriber portal — check usage and pay invoices
            </p>
          </div>

          <Card className="border border-border/60 shadow-lg dark:border-border/50">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Use your internet username and password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={login} className="space-y-4">
                {error && <Alert type="error" message={error} />}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={busy || !username || !password}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Pay invoices with a Whish payment link — approve in the{" "}
            <a
              href={WHISH_GET_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Whish Money app
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-app-shell min-h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 p-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Wifi className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Xnet subscriber</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {me?.fullName || me?.username || "My account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{me?.username}
              {me?.planName ? ` · ${me.planName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => token && load(token)}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut />
              Log out
            </Button>
          </div>
        </header>

        {error && <Alert type="error" message={error} />}
        {notice && <Alert type="success" message={notice} />}

        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/60 shadow-sm sm:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Account</CardTitle>
                <Badge variant={statusVariant(me?.accountStatus)}>
                  {me?.accountStatus || "unknown"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Plan</div>
                <div className="font-medium">{me?.planName || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Expires</div>
                <div className="font-medium">{formatDate(me?.expiresAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div className="font-medium break-all">{me?.email || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div className="font-medium">{me?.phone || "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-primary/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Wallet balance
              </CardTitle>
              <CardDescription>
                {me?.isExpired
                  ? "Account expired — pay an invoice from wallet to renew"
                  : unpaid.length === 0
                    ? "Top up via Whish, then pay invoices from balance"
                    : `${unpaid.length} open invoice${unpaid.length === 1 ? "" : "s"}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {formatMoney(Number(me?.walletBalance ?? 0), currency)}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                {qrEnabled
                  ? "1) Pay Whish QR → 2) Staff approves → 3) Pay invoice from wallet"
                  : "Wallet credits after staff approve your Whish payment"}
              </p>
              {unpaid.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Open invoices total {formatMoney(unpaidTotal, currency)}
                </p>
              ) : null}
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={openBuyVoucherModal}
                  className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
                >
                  <Ticket className="h-4 w-4" />
                  Buy Voucher / Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Redeem Scratch Card / Voucher Card */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-r from-primary/5 via-background to-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-5 w-5 text-primary" />
              Redeem Scratch Card / Voucher
            </CardTitle>
            <CardDescription>
              Have a prepaid voucher or scratch card? Enter the 12-digit PIN code to top up your account instantly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={redeemVoucher} className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <Input
                value={voucherPin}
                onChange={(e) => setVoucherPin(e.target.value.toUpperCase())}
                placeholder="Voucher PIN (e.g. XNET-8921-9012)"
                className="font-mono text-sm tracking-wider font-semibold uppercase bg-background"
                disabled={redeemingVoucher}
              />
              <Button
                type="submit"
                disabled={redeemingVoucher || !voucherPin.trim()}
                className="gap-2 shrink-0 bg-primary font-semibold"
              >
                {redeemingVoucher ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Apply Voucher
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {walletLedger.length > 0 ? (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Wallet activity
              </CardTitle>
              <CardDescription>Recent top-ups and payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {walletLedger.slice(0, 12).map((e: any) => {
                const isCredit = e.entryType === "credit";
                const refType = String(e.referenceType || "");
                const label =
                  refType === "whish_claim"
                    ? "Whish top-up"
                    : refType === "external_invoice"
                      ? `Invoice #${String(e.referenceId || "").split(":")[0]}`
                      : refType === "admin_credit"
                        ? "Staff credit"
                        : refType || "Wallet";
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 font-semibold ${
                        isCredit ? "text-green-700 dark:text-green-400" : ""
                      }`}
                    >
                      {isCredit ? "+" : "−"}
                      {formatMoney(Number(e.amount), e.currency || currency)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Data usage
            </CardTitle>
            <CardDescription>Today and this billing month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Daily</span>
                <span className="text-muted-foreground">
                  {formatBytes(usage?.dailyUsed)}
                  {usage?.dailyQuota > 0 ? ` / ${formatBytes(usage.dailyQuota)}` : " · unlimited"}
                </span>
              </div>
              <Progress
                value={usage?.dailyQuota > 0 ? dailyPct : 0}
                className="h-2.5 w-full"
                indicatorClassName={dailyPct >= 90 ? "bg-destructive" : "bg-primary"}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Monthly</span>
                <span className="text-muted-foreground">
                  {formatBytes(usage?.monthlyUsed)}
                  {usage?.monthlyQuota > 0 ? ` / ${formatBytes(usage.monthlyQuota)}` : " · unlimited"}
                </span>
              </div>
              <Progress
                value={usage?.monthlyQuota > 0 ? monthlyPct : 0}
                className="h-2.5 w-full"
                indicatorClassName={monthlyPct >= 90 ? "bg-destructive" : "bg-primary"}
              />
            </div>
            {usage?.isFallback ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                You are currently on a fallback / limited profile.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  Invoices
                </CardTitle>
                <CardDescription>
                  {qrEnabled
                    ? "Scan our Whish QR and pay the exact invoice amount"
                    : "Secure Whish payment link — approve in the app"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-normal">
                {qrEnabled
                  ? "Whish QR ready"
                  : whishReady
                    ? "Whish connected"
                    : "Whish pending setup"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {qrEnabled ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 rounded-2xl border bg-white p-3 shadow-sm">
                    {!qrBroken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrImageUrl}
                        alt={provider?.qrLabel || "Whish payment QR"}
                        className="h-44 w-44 object-contain"
                        onError={() => setQrBroken(true)}
                      />
                    ) : (
                      <div className="flex h-44 w-44 items-center justify-center text-center text-xs text-muted-foreground">
                        QR image failed to load
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    <p className="font-semibold text-foreground">
                      {provider?.qrLabel || "Pay with Whish QR"}
                    </p>
                    <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                      <li>Top up: scan Whish QR and submit your transaction reference.</li>
                      <li>Staff approve → amount is credited to your wallet.</li>
                      <li>
                        Tap <strong className="text-foreground">Pay from wallet</strong> on an invoice
                        (renews if expired).
                      </li>
                    </ol>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={openWhishDeepLink}>
                        <ExternalLink />
                        Open in Whish
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(qrDeepLink);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {
                            setError("Could not copy Whish link");
                          }
                        }}
                      >
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Copied" : "Copy link"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-foreground">How Whish payment works</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                  <li>
                    Tap <strong className="text-foreground">Pay with Whish</strong> to create a secure
                    payment link.
                  </li>
                  <li>Open the link and approve the amount in the Whish Money app.</li>
                  <li>Return here and tap Refresh — your invoice updates when payment is confirmed.</li>
                </ol>
              </div>
            )}
            {invoices.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No invoices yet.
              </div>
            )}
            {invoices.map((inv) => {
              const paid = String(inv.status || "").toLowerCase() === "paid";
              const amount = Number(inv.totalAmount ?? inv.amount ?? 0);
              const remaining = Number(inv.remainingDue ?? amount);
              const amountPaidToward = Number(inv.amountPaidToward ?? 0);
              const bal = Number(me?.walletBalance ?? 0);
              const canPayPartial = !paid && bal + 1e-9 >= 0.01;
              const isPartialAvailable = canPayPartial && bal + 1e-9 < remaining;
              const isPaying = payingId === inv.id;
              return (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{formatMonth(inv.billingMonth)}</span>
                      <Badge variant={statusVariant(inv.status)}>{inv.status || "—"}</Badge>
                      {!paid && amountPaidToward > 0 ? (
                        <Badge variant="secondary" className="font-normal">
                          Partial {formatMoney(amountPaidToward, currency)} paid
                        </Badge>
                      ) : null}
                      {inv.debitLabel ? (
                        <Badge variant="outline" className="font-normal">
                          {inv.debitLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatMoney(amount, currency)}
                        {!paid && remaining < amount - 1e-9
                          ? ` · remaining ${formatMoney(remaining, currency)}`
                          : ""}
                      </span>
                      {inv.payDueDate ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Due {formatDate(inv.payDueDate)}
                        </span>
                      ) : null}
                      {paid && inv.paidAt ? (
                        <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Paid {formatDate(inv.paidAt)}
                          {String(inv.paymentMethod || inv.paymentProvider || "").toLowerCase() ===
                          "wallet"
                            ? " from wallet"
                            : ""}
                        </span>
                      ) : null}
                      {paid && inv.paymentReference ? (
                        <span className="font-mono text-xs">
                          Txn {inv.paymentReference}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!paid ? (
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <Button
                        disabled={walletPayingId !== null || !canPayPartial}
                        onClick={() => payFromWallet(inv)}
                      >
                        {walletPayingId === inv.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <CreditCard />
                        )}
                        {walletPayingId === inv.id
                          ? "Paying…"
                          : isPartialAvailable
                            ? `Pay ${formatMoney(Math.min(bal, remaining), currency)} now`
                            : me?.isExpired
                              ? "Pay & renew"
                              : "Pay from wallet"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPaying || payingId !== null}
                        onClick={() => payWithWhish(inv)}
                      >
                        {isPaying ? <Loader2 className="animate-spin" /> : <Smartphone />}
                        {isPaying ? "Creating…" : "Top up via Whish"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Separator className="my-1" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {qrEnabled
                ? "Your Whish receive QR is shown at checkout. After you pay in the app, staff may still need to confirm the invoice until the gateway webhook is configured."
                : (
                  <>
                    Same flow as Whish&apos;s{" "}
                    <a
                      href={WHISH_ADD_TRANSFER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      Send Payment Link
                    </a>
                    : you get a secure link, the payer opens it, and funds settle in Whish.
                  </>
                )}
            </p>
          </CardContent>
        </Card>

        <Dialog open={!!paySheet} onOpenChange={(open) => !open && setPaySheet(null)}>
          <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
            <div className="border-b bg-primary/5 px-5 pb-4 pt-5">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start justify-between gap-3 pr-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">
                        {paySheet?.mode === "link" ? "Whish payment link" : "Top up with Whish"}
                      </DialogTitle>
                      <DialogDescription className="text-left">
                        Invoice #{paySheet?.invoiceId}
                        {me?.username ? ` · @${me.username}` : ""}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-background/80 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Send exactly
                  </p>
                  <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground">
                    {paySheet?.amountLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="font-normal">
                    1. Pay in Whish
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 self-center text-muted-foreground" />
                  <Badge variant="secondary" className="font-normal">
                    2. Submit reference
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 self-center text-muted-foreground" />
                  <Badge variant="outline" className="font-normal">
                    3. Staff credits wallet
                  </Badge>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-5 py-5">
              {(paySheet?.mode === "qr" || paySheet?.mode === "both") && qrEnabled ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Scan or open Whish</h3>
                    <a
                      href={WHISH_GET_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Get the app
                    </a>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                    <div className="mx-auto rounded-2xl border bg-white p-3 shadow-sm dark:bg-white">
                      {!qrBroken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrImageUrl}
                          alt={provider?.qrLabel || "Whish payment QR"}
                          className="h-44 w-44 object-contain sm:h-48 sm:w-48"
                          onError={() => setQrBroken(true)}
                        />
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground sm:h-48 sm:w-48">
                          QR image missing
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 text-sm">
                      <ol className="space-y-2.5">
                        <li className="flex gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            1
                          </span>
                          <span className="text-muted-foreground pt-0.5">
                            Open <strong className="text-foreground">Whish Money</strong> and scan the QR
                            (or tap Open in Whish).
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            2
                          </span>
                          <span className="text-muted-foreground pt-0.5">
                            Enter{" "}
                            <strong className="text-foreground">{paySheet?.amountLabel}</strong> exactly.
                          </span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            3
                          </span>
                          <span className="text-muted-foreground pt-0.5">
                            In the note, put{" "}
                            <strong className="text-foreground">
                              #{paySheet?.invoiceId}
                              {me?.username ? ` / ${me.username}` : ""}
                            </strong>
                            .
                          </span>
                        </li>
                      </ol>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {qrDeepLink ? (
                          <Button className="flex-1 sm:flex-none" onClick={openWhishDeepLink}>
                            <ExternalLink />
                            Open in Whish
                          </Button>
                        ) : null}
                        {qrDeepLink ? (
                          <Button variant="outline" onClick={copyWhishLink}>
                            {copied ? <Check /> : <Copy />}
                            {copied ? "Copied" : "Copy link"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {(paySheet?.mode === "link" || paySheet?.mode === "both") && paySheet?.checkoutUrl ? (
                <section className="space-y-2 rounded-xl border p-3">
                  <h3 className="text-sm font-semibold">
                    {paySheet.mode === "both" ? "Or use payment link" : "Payment link"}
                  </h3>
                  <div className="rounded-lg bg-muted/50 p-2.5 break-all font-mono text-[11px] leading-relaxed">
                    {paySheet.checkoutUrl}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={copyWhishLink}>
                      {copied ? <Check /> : <Copy />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={openWhishLink}>
                      <ExternalLink />
                      Open link
                    </Button>
                  </div>
                  {!whishReady && paySheet.provider === "stub" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Test checkout — real Whish links appear after gateway credentials are set.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <Separator />

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">After you pay — submit reference</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste the Whish transaction / reference from your receipt. Staff will credit your
                    wallet, then you can pay the invoice from balance.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="whish-ref">Whish reference / transaction #</Label>
                    <Input
                      id="whish-ref"
                      placeholder="e.g. from Whish receipt"
                      value={whishReference}
                      onChange={(e) => setWhishReference(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whish-amount">Amount paid</Label>
                    <Input
                      id="whish-amount"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={reportAmount}
                      onChange={(e) => setReportAmount(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={reporting || whishReference.trim().length < 4}
                  onClick={reportWhishPayment}
                >
                  {reporting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {reporting ? "Submitting…" : "Submit payment reference"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={finishPaySheet}>
                  Close — I&apos;ll submit later
                </Button>
              </section>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent sessions</CardTitle>
            <CardDescription>Latest RADIUS connections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent sessions.</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.radacctid || `${s.acctsessionid}-${s.acctstarttime}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{formatDate(s.acctstarttime)}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.framedipaddress || s.framedIPAddress || "—"}
                    {s.callingstationid ? ` · ${s.callingstationid}` : ""}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{s.acctstoptime ? "Ended" : "Online"}</div>
                  <div>
                    {formatBytes(
                      Number(s.acctinputoctets || 0) + Number(s.acctoutputoctets || 0)
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Buy Voucher / Plan from Wallet */}
      <Dialog open={isBuyVoucherOpen} onOpenChange={setIsBuyVoucherOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Buy Voucher Plan from Wallet Balance
            </DialogTitle>
            <DialogDescription>
              Select a plan profile to purchase and activate immediately using your wallet balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">Your Wallet Balance</div>
              <div className="text-lg font-bold text-primary">
                {formatMoney(Number(me?.walletBalance ?? 0), currency)}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Target Plan</Label>
              {voucherPlans.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 border rounded-lg text-center">
                  Loading available plans...
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {voucherPlans.map((plan) => {
                    const isSelected = plan.id === selectedPlanId;
                    const canAfford = Number(me?.walletBalance ?? 0) >= plan.price;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary/50 shadow-xs ring-1 ring-primary/40"
                            : "bg-card hover:bg-muted/40 border-border/70"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">{plan.profileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {plan.durationDays} Days
                            {plan.monthlyQuotaGB ? ` · ${plan.monthlyQuotaGB} GB Quota` : " · Unlimited"}
                            {plan.speedDownMbps ? ` · ${plan.speedDownMbps} Mbps Speed` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-foreground">${plan.price.toFixed(2)}</div>
                          {!canAfford ? (
                            <span className="text-[10px] text-destructive font-semibold">Low Balance</span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold">Available</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBuyVoucherOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBuyVoucher}
              disabled={
                buyingVoucher ||
                !selectedPlanId ||
                Number(me?.walletBalance ?? 0) <
                  (voucherPlans.find((p) => p.id === selectedPlanId)?.price ?? 99999)
              }
              className="gap-2 bg-primary font-semibold text-primary-foreground"
            >
              {buyingVoucher ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Buy & Activate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SubscriberPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="shop-app-shell flex min-h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading portal…
        </div>
      }
    >
      <SubscriberPortalContent />
    </Suspense>
  );
}
