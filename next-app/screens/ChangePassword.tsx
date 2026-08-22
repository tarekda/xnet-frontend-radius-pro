import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { changePassword } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STAFF_PASSWORD_MIN_LENGTH, validateStaffPassword } from "@/lib/passwordPolicy";

export default function ChangePasswordPage() {
  const { t } = useTranslation("screens");
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    if (!currentPassword.trim()) return false;
    if (!validateStaffPassword(newPassword).ok) return false;
    if (newPassword !== confirm) return false;
    return true;
  }, [confirm, currentPassword, newPassword]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      updateUser({ mustChangePassword: false });
      notify.success("Password updated", "You can now use the system.");

      const redirectTo = localStorage.getItem("redirectTo");
      if (redirectTo) localStorage.removeItem("redirectTo");
      router.replace(redirectTo || "/");
    } catch (err: any) {
      notify.error("Change password failed", err?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shop-app-shell flex min-h-full items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            XN
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t("changePassword.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.mustChangePassword ? t("changePassword.subtitle_first_login") : t("changePassword.subtitle")}
          </p>
        </div>

        <Card className="border-border/80 shadow-[var(--shop-shadow)]">
          <CardHeader className="space-y-2 border-b border-border/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Change your password</CardTitle>
                <CardDescription>
                  {user?.mustChangePassword
                    ? "First login requires a password change."
                    : "Update your password."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder={`New password (min ${STAFF_PASSWORD_MIN_LENGTH} chars, upper, lower, number)`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={STAFF_PASSWORD_MIN_LENGTH}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={!canSubmit || saving}>
                {saving ? "Saving..." : "Update password"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border/70 p-5">
            <Button variant="outline" className="w-full" onClick={logout}>
              Logout
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
