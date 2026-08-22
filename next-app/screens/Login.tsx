import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useLogin from "@/hooks/useLogin";
import { useRouter } from "next/navigation";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Lock, User, Shield } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

const Login: React.FC = () => {
  const { t } = useTranslation("screens");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const { login, verifyMfa, isLoading, error } = useLogin();
  const { login: authLogin, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = localStorage.getItem("login.rememberMe");
    if (raw === null) return;
    setRememberMe(raw === "true");
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const from = searchParams.get("from");
    const target = from && from.startsWith("/") && from !== "/login" ? from : "/";
    router.replace(target);
  }, [isAuthenticated, router, searchParams]);

  const finishLogin = (user: any, accessToken: string, refreshToken: string) => {
    localStorage.setItem("login.rememberMe", String(Boolean(rememberMe)));
    authLogin(user, accessToken, rememberMe, refreshToken);
    let redirectPath = "/";
    const fromQs = searchParams.get("from");
    const fromDecoded = fromQs ? decodeURIComponent(fromQs) : null;
    const storedPath = localStorage.getItem("redirectTo");
    if (fromDecoded && fromDecoded !== "/login") redirectPath = fromDecoded;
    else if (storedPath && storedPath !== "/login") redirectPath = storedPath;
    if (storedPath) localStorage.removeItem("redirectTo");
    router.replace(redirectPath);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mfaToken) {
      const resp = await verifyMfa(mfaToken, mfaCode);
      if (resp?.success && "accessToken" in resp.data) {
        finishLogin(resp.data.user, resp.data.accessToken, resp.data.refreshToken);
      }
      return;
    }

    const resp = await login(username, password);
    if (!resp?.success) return;
    if ("mfaRequired" in resp.data && resp.data.mfaRequired) {
      setMfaToken(resp.data.mfaToken);
      return;
    }
    if ("accessToken" in resp.data) {
      finishLogin(resp.data.user, resp.data.accessToken, resp.data.refreshToken);
    }
  };

  return (
    <div className="shop-app-shell flex min-h-full items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            XN
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <Card className="border-border/80 shadow-[var(--shop-shadow)]">
          <CardHeader className="space-y-2 border-b border-border/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                {mfaToken ? <Shield className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </div>
              <div>
                <CardTitle className="text-base">
                  {mfaToken ? "Two-factor authentication" : "Welcome back"}
                </CardTitle>
                <CardDescription>
                  {mfaToken
                    ? "Enter the 6-digit code from your authenticator app"
                    : "Enter your credentials to access your account"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!mfaToken ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter your username"
                        className="pl-9"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(Boolean(v))}
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                      Remember me
                    </Label>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mfaCode">Authenticator code</Label>
                    <Input
                      id="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={8}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setMfaToken(null);
                      setMfaCode("");
                    }}
                  >
                    Back to password
                  </Button>
                </div>
              )}
              {error && <Alert type="error" message={error} />}
              <Button className="w-full" disabled={isLoading} type="submit">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mfaToken ? "Verifying..." : "Signing in..."}
                  </>
                ) : mfaToken ? (
                  "Verify"
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
