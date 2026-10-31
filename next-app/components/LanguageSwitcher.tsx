"use client";

import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyDocumentLanguage } from "@/lib/applyDocumentLanguage";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "es", label: "Español" },
] as const;

export function LanguageSwitcher({ className, id = "language" }: { className?: string; id?: string }) {
  const { i18n } = useTranslation();
  const current = (i18n.language || "en").split("-")[0] || "en";

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        void i18n.changeLanguage(v);
        applyDocumentLanguage(v);
        try {
          localStorage.setItem("app.lang", v);
        } catch {
          /* ignore */
        }
      }}
    >
      <SelectTrigger id={id} className={cn("w-[140px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
