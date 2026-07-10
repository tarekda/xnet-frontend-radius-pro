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
import { createReseller, createResellerLogin, fetchResellerLedger, fetchResellers, fundReseller, type ResellerDto, type ResellerLoginDto } from "@/api/resellers";
import TableRowActions from "@/components/TableRowActions";
import { useTranslation } from "react-i18next";

export default function ResellersPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canManage = can(user, "admin.resellers.manage");
  const canFund = can(user, "admin.resellers.fund");

  const [rows, setRows] = useState<ResellerDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

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

  const onFund = async (r: ResellerDto) => {
    if (!canFund) return;
    const amountStr = prompt(`Fund reseller ${r.code} (amount):`);
    if (!amountStr) return;
    const amt = Number(amountStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify.error("Invalid amount", "Enter a number > 0");
      return;
    }
    try {
      await fundReseller(r.id, { amount: amt });
      const ledger = await fetchResellerLedger(r.id);
      notify.success("Funded", `New balance: ${ledger.balance.toFixed(2)}`);
    } catch (e: any) {
      notify.error("Fund failed", e?.message || "Failed to fund reseller");
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No resellers.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.isActive ? "active" : "inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <TableRowActions
                          actions={[
                            { label: "Create login", onClick: () => openCreateLogin(r) },
                            { label: "Fund", onClick: () => onFund(r), disabled: !canFund },
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

