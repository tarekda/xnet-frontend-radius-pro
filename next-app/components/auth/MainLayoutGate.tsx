"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageSkeleton from "@/components/PageSkeleton";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

export default function MainLayoutGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      const from = encodeURIComponent(`${pathname}${typeof window !== "undefined" ? window.location.search : ""}`);
      router.replace(`/login?from=${from}`);
    }
  }, [isAuthenticated, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.mustChangePassword) return;
    if (pathname === "/change-password") return;
    localStorage.setItem("redirectTo", pathname);
    router.replace("/change-password");
  }, [isAuthenticated, user, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.mfaRequired) return;
    if (pathname === "/settings/security" || pathname === "/change-password") return;
    localStorage.setItem("redirectTo", pathname);
    router.replace("/settings/security");
  }, [isAuthenticated, user, pathname, router]);

  if (!isAuthenticated) return <PageSkeleton />;

  if (user?.mustChangePassword && pathname !== "/change-password") return <PageSkeleton />;
  if (user?.mfaRequired && pathname !== "/settings/security" && pathname !== "/change-password") {
    return <PageSkeleton />;
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<PageSkeleton />}>
        <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      </Suspense>
    </DashboardLayout>
  );
}
