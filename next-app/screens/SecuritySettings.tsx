"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Shield } from "lucide-react";
import Alert from "@/components/ui/Alert";

export default function SecuritySettingsScreen() {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState<{ mfaEnabled: boolean; mfaRequired: boolean } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await apiClient.get("/auth/mfa/status");
    setStatus(res.data.data);
  };

  useEffect(() => {
    refresh().catch(() => setError("Failed to load MFA status"));
  }, []);

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post("/auth/mfa/setup");
      setSetup(res.data.data);
      setBackupCodes(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post("/auth/mfa/confirm", { code });
      setBackupCodes(res.data.data.backupCodes);
      setSetup(null);
      setCode("");
      setMessage("MFA enabled. Store your backup codes securely.");
      updateUser?.({ mfaEnabled: true, mfaRequired: false } as any);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/auth/mfa/disable", { password, code });
      setMessage("MFA disabled");
      setPassword("");
      setCode("");
      updateUser?.({ mfaEnabled: false } as any);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Security" subtitle="Two-factor authentication (TOTP)" icon={Shield} />
      {status?.mfaRequired && (
        <Alert type="error" message="Your role requires MFA. Enroll before continuing." />
      )}
      {message && <Alert type="success" message={message} />}
      {error && <Alert type="error" message={error} />}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle>Authenticator app</CardTitle>
          <CardDescription>
            Status: {status?.mfaEnabled ? "Enabled" : "Disabled"}
            {user?.username ? ` · ${user.username}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!status?.mfaEnabled && !setup && (
            <Button onClick={startSetup} disabled={busy}>
              Enable MFA
            </Button>
          )}
          {setup && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground break-all">Secret: {setup.secret}</p>
              <p className="text-xs text-muted-foreground break-all">{setup.otpauthUrl}</p>
              <Input
                placeholder="Enter 6-digit code"
                aria-label="Authenticator code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button onClick={confirmSetup} disabled={busy || code.length < 6}>
                Confirm enrollment
              </Button>
            </div>
          )}
          {backupCodes && (
            <div className="rounded border p-3 text-sm">
              <p className="font-medium mb-2">Backup codes (save now)</p>
              <ul className="font-mono grid grid-cols-2 gap-1">
                {backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {status?.mfaEnabled && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Disable MFA</p>
              <Input
                type="password"
                placeholder="Current password"
                aria-label="Current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                placeholder="Current MFA code"
                aria-label="Current MFA code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button variant="destructive" onClick={disable} disabled={busy}>
                Disable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
