import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { changePassword } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    if (newPassword.length < 8) return false;
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
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title={t("changePassword.title")}
          subtitle={user?.mustChangePassword ? t("changePassword.subtitle_first_login") : t("changePassword.subtitle")}
          icon={KeyRound}
        />

      <Card className="w-full border border-border/60 shadow-lg dark:border-border/50 dark:shadow-[var(--shop-shadow,0_4px_24px_rgba(0,0,0,0.35))]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Change your password</CardTitle>
          <CardDescription className="text-center">
            {user?.mustChangePassword
              ? "First login requires a password change."
              : "Update your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <Button className="w-full" type="submit" disabled={!canSubmit || saving}>
              {saving ? "Saving..." : "Update password"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}

