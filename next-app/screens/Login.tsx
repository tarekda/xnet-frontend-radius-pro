import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import useLogin from '@/hooks/useLogin';
import { useRouter } from 'next/navigation';
import { useSearchParams } from '@/navigation/urlSearchParams';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Lock, User } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import PageHeader from "@/components/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

const Login: React.FC = () => {
  const { t } = useTranslation("screens");
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const { login, isLoading, error } = useLogin();
  const { login: authLogin, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = localStorage.getItem("login.rememberMe");
    if (raw === null) return;
    setRememberMe(raw === "true");
  }, []);

  // Already signed in (e.g. session predating the middleware cookie): skip the form.
  useEffect(() => {
    if (!isAuthenticated) return;
    const from = searchParams.get("from");
    const target = from && from.startsWith("/") && from !== "/login" ? from : "/";
    router.replace(target);
  }, [isAuthenticated, router, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const resp = await login(username, password);
    if (resp?.data.accessToken) {
      localStorage.setItem("login.rememberMe", String(Boolean(rememberMe)));
      authLogin(resp.data.user, resp.data.accessToken, rememberMe, resp.data.refreshToken);
      let redirectPath = '/';
      const fromQs = searchParams.get("from");
      const fromDecoded = fromQs ? decodeURIComponent(fromQs) : null;
      const storedPath = localStorage.getItem('redirectTo');
      if (fromDecoded && fromDecoded !== '/login') {
        redirectPath = fromDecoded;
      } else if (storedPath && storedPath !== '/login') {
        redirectPath = storedPath;
      }
      if (storedPath) {
        localStorage.removeItem('redirectTo');
      }
      router.replace(redirectPath);
    }
  };

  return (
    <div className="shop-app-shell flex min-h-full items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title={t("login.title")}
          subtitle={t("login.subtitle")}
          icon={Lock}
        />

      <Card className="w-full border border-border/60 shadow-lg dark:border-border/50 dark:shadow-[var(--shop-shadow,0_4px_24px_rgba(0,0,0,0.35))]">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-primary/15 p-3 dark:bg-primary/25">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
            <div className="flex items-center justify-between">
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
              <a
                href="#"
                className="text-sm text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline"
              >
                Forgot your password?
              </a>
            </div>
            {error && (
              <Alert
                type="error"
                message={error}
              />
            )}
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4" />
      </Card>
      </div>
    </div>
  );
};

export default Login;