import React from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation("screens");
  const router = useRouter();

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader title={t("notFound.title")} subtitle={t("notFound.subtitle")} icon={SearchX} />
      <EmptyState
        title="404 — Not Found"
        description="Check the URL or go back to the dashboard."
        icon={SearchX}
        actionLabel="Go to dashboard"
        onAction={() => router.push("/dashboard")}
      />
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push("/")}>
          <Home className="h-4 w-4 mr-2" />
          Home
        </Button>
      </div>
    </div>
  );
}

