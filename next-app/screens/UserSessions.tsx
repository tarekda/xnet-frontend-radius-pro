import UserSessionsPanel from "@/components/UserSessionsPanel";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { ArrowLeft, History } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function UserSessionsPage() {
  const { t } = useTranslation("screens");
  const router = useRouter();
  const { username: usernameParam } = useParams();
  const username = String(usernameParam ?? "").trim();

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader
        title={t("userSessions.title")}
        subtitle={username ? t("userSessions.subtitle_for", { username }) : t("userSessions.subtitle")}
        icon={History}
        actions={
          <div className="flex gap-2">
            <IconActionButton label="Back" onClick={() => router.back()} icon={<ArrowLeft className="h-4 w-4" />} />
          </div>
        }
      />

      <UserSessionsPanel username={username} />
    </div>
  );
}

