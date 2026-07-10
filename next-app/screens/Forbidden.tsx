import React from "react";
import { usePathname, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Home, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ForbiddenPage() {
  const { t } = useTranslation("screens");
  const router = useRouter();
  const pathname = usePathname();
  const path = pathname || "";

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader
        title={t("forbidden.title")}
        subtitle={path ? t("forbidden.subtitle_path", { path }) : t("forbidden.subtitle")}
        icon={ShieldAlert}
      />
      <EmptyState
        title="403 — Forbidden"
        description="If you believe this is a mistake, ask an admin to update your role permissions."
        icon={ShieldAlert}
        actionLabel="Go to Dashboard"
        onAction={() => router.push("/dashboard")}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ShieldAlert className="h-4 w-4" />
          Go back
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/")}
        >
          <Home className="h-4 w-4" />
          Home
        </button>
      </div>
    </div>
  );
}

