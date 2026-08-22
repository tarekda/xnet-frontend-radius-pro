import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { createReseller, createResellerLogin, debitReseller, fetchResellerLedger, fetchResellers, fundReseller, type ResellerDto, type ResellerLoginDto } from "@/api/resellers";
import { fetchCompanyWalletBalance } from "@/api/companyWallet";
import TableRowActions from "@/components/TableRowActions";
import { useTranslation } from "react-i18next";

export default function ResellersPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canManage = can(user, "admin.resellers.manage");
  const canFund = can(user, "admin.resellers.fund");

  const [rows, setRows] = useState<ResellerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyBalance, setCompanyBalance] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [fundOpen, setFundOpen] = useState(false);
  const [fundTarget, setFundTarget] = useState<ResellerDto | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [fundSaving, setFundSaving] = useState(false);
  const [walletMode, setWalletMode] = useState<"credit" | "debit">("credit");

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReseller, setLoginReseller] = useState<ResellerDto | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginResult, setLoginResult] = useState<ResellerLoginDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchResellers();
      setRows(list);
      try {
        setCompanyBalance(await fetchCompanyWalletBalance());
      } catch {
        setCompanyBalance(null);
      }
    } catch (e: any) {
      notify.error("Load failed", e?.message || "Failed to load resellers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const onCreate = async () => {
    try {
      const r = await createReseller({ name, code });
      notify.success("Created", `Reseller ${r.code} created`);
      setName("");
      setCode("");
      await load();
    } catch (e: any) {
      notify.error("Create failed", e?.message || "Failed to create reseller");
    }
  };

  const openFundDialog = (r: ResellerDto, mode: "credit" | "debit" = "credit") => {
    if (!canFund) return;
    setFundTarget(r);
    setFundAmount("");
    setWalletMode(mode);
    setFundOpen(true);
  };

  const onFund = async () => {
    if (!canFund || !fundTarget) return;
    const amt = Number(fundAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify.error("Invalid amount", "Enter a number > 0");
      return;
    }
    setFundSaving(true);
    try {
      if (walletMode === "debit") {
        const result = await debitReseller(fundTarget.id, { amount: amt });
        notify.success("Debited", `New balance: ${Number(result.balance).toFixed(2)}`);
      } else {
        const result = await fundReseller(fundTarget.id, { amount: amt });
        const balance =
          result && typeof result === "object" && "balance" in result
            ? Number((result as { balance: number }).balance)
            : (await fetchResellerLedger(fundTarget.id)).balance;
        notify.success("Funded", `New balance: ${balance.toFixed(2)}`);
      }
      setFundOpen(false);
      setFundTarget(null);
      setFundAmount("");
      await load();
    } catch (e: any) {
      notify.error(
        walletMode === "debit" ? "Debit failed" : "Fund failed",
        e?.response?.data?.message || e?.message || "Failed to update reseller wallet"
      );
    } finally {
      setFundSaving(false);
    }
  };

  const openCreateLogin = (r: ResellerDto) => {
    setLoginReseller(r);
    setLoginUsername("");
    setLoginEmail("");
    setLoginPassword("");
    setLoginResult(null);
    setLoginOpen(true);
  };

  const onCreateLogin = async () => {
    if (!loginReseller) return;
    setLoginSaving(true);
    try {
      const created = await createResellerLogin(loginReseller.id, {
        username: loginUsername,
        email: loginEmail,
        password: loginPassword.trim() ? loginPassword : undefined,
      });
      setLoginResult(created);

      if (created.tempPassword) {
        notify.success("Login created", "Temp password generated. Copy it now (shown in dialog).");
      } else {
        notify.success("Login created", "Reseller login created.");
      }
    } catch (e: any) {
      notify.error("Create login failed", e?.message || "Failed to create reseller login");
    } finally {
      setLoginSaving(false);
    }
  };

  const title = useMemo(() => `Resellers (${rows.length})`, [rows.length]);

  if (!canManage) {
    return (
      <div className="w-full space-y-6 py-6">
        <PageHeader title={t("resellers.title")} subtitle={t("resellers.subtitle_forbidden")} />
        <Card><CardContent className="p-6">You don’t have access.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-6">
      <PageHeader title={t("resellers.title")} subtitle={t("resellers.subtitle")} />

      {companyBalance != null ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm text-muted-foreground">Company wallet</div>
              <div className="text-2xl font-semibold">{companyBalance.toFixed(2)}</div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/company-wallet">Open ledger</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create reseller</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code (unique)" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button onClick={onCreate} disabled={!name.trim() || !code.trim()}>
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <IconActionButton
            label={loading ? "Refreshing..." : "Refresh"}
            onClick={load}
            disabled={loading}
            icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No resellers.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.isActive ? "active" : "inactive"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(r.balance ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <TableRowActions
                          actions={[
                            { label: "Create login", onClick: () => openCreateLogin(r) },
                            { label: "Fund", onClick: () => openFundDialog(r, "credit"), disabled: !canFund },
                            { label: "Debit", onClick: () => openFundDialog(r, "debit"), disabled: !canFund },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={fundOpen}
        onOpenChange={(open) => {
          if (fundSaving) return;
          setFundOpen(open);
          if (!open) {
            setFundTarget(null);
            setFundAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{walletMode === "debit" ? "Debit reseller wallet" : "Fund reseller wallet"}</DialogTitle>
            <DialogDescription>
              {fundTarget ? (
                <>
                  {walletMode === "debit" ? "Remove credit from" : "Add credit to"} reseller{" "}
                  <span className="font-mono">{fundTarget.code}</span>.
                  {walletMode === "credit"
                    ? " This debits the company wallet."
                    : " This returns funds to the company wallet."}
                </>
              ) : (
                walletMode === "debit" ? "Remove credit from this reseller." : "Add credit to this reseller."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="fund-amount">Amount</Label>
            <Input
              id="fund-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !fundSaving) void onFund();
              }}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundOpen(false)} disabled={fundSaving}>
              Cancel
            </Button>
            <Button
              onClick={onFund}
              disabled={fundSaving || !fundTarget || !Number.isFinite(Number(fundAmount)) || Number(fundAmount) <= 0}
            >
              {fundSaving ? (walletMode === "debit" ? "Debiting..." : "Adding credit...") : walletMode === "debit" ? "Debit" : "Add credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create reseller login</DialogTitle>
            <DialogDescription>
              {loginReseller ? (
                <span>
                  Create a web login for reseller <span className="font-mono">{loginReseller.code}</span>. The user will be forced to change password on first login.
                </span>
              ) : (
                "Create a web login for this reseller."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="login-username">Username</Label>
              <Input id="login-username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="reseller_username" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="reseller@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-password">Password (optional)</Label>
              <Input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Leave empty to auto-generate temp password"
              />
            </div>

            {loginResult?.tempPassword ? (
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-sm font-medium">Temp password (copy now)</div>
                <div className="font-mono text-sm break-all">{loginResult.tempPassword}</div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={onCreateLogin}
              disabled={
                loginSaving ||
                !loginReseller ||
                !loginUsername.trim() ||
                !loginEmail.trim()
              }
            >
              {loginSaving ? "Creating..." : "Create login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

