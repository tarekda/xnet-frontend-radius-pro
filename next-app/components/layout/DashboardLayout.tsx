import React from "react";
import Sidebar from "@/components/ui/Sidebar/Sidebar";
import Breadcrumb from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/utils";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import SystemHealthStrip from "@/components/SystemHealthStrip";
import ExternalInvoicePayDueInboxSync from "@/components/ExternalInvoicePayDueInboxSync";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { density } = useAppPreferences();

  return (
    <div className="shop-app-shell flex h-full min-h-0 flex-col overflow-hidden">
      <a
        href="#main-content"
        className={cn(
          "fixed left-3 top-4 z-[300] -translate-y-24 rounded-md px-4 py-2 text-sm font-medium shadow-lg",
          "bg-primary text-primary-foreground outline-none ring-2 ring-ring",
          "pointer-events-none opacity-0 transition-all",
          "focus:pointer-events-auto focus:translate-y-0 focus:opacity-100"
        )}
      >
        Skip to main content
      </a>
      <SystemHealthStrip />
      <ExternalInvoicePayDueInboxSync />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto scroll-smooth bg-background",
            "outline-none",
            "px-4 pb-8 sm:px-6 lg:px-8",
            density === "compact" && "table-compact"
          )}
        >
          <GlobalCommandPalette />
          <div className="w-full">
            <Breadcrumb />
            <div className="w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
