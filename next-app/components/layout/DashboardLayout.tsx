"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/ui/Sidebar/Sidebar";
import Breadcrumb from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/utils";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import SystemHealthStrip from "@/components/SystemHealthStrip";
import ExternalInvoicePayDueInboxSync from "@/components/ExternalInvoicePayDueInboxSync";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import { RadiusCopilot } from "@/components/RadiusCopilot";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { density } = useAppPreferences();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // The drawer declares aria-modal, so keyboard focus must not escape into the page behind it.
  useFocusTrap(drawerRef, drawerMounted);

  // Handle smooth open/close with CSS transition
  const openCopilot = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setDrawerMounted(true);
    setCopilotOpen(true);
    // Let DOM mount first, then trigger transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerVisible(true));
    });
  };

  const closeCopilot = () => {
    setDrawerVisible(false);
    setCopilotOpen(false);
    // Unmount after CSS transition finishes
    closeTimeoutRef.current = setTimeout(() => setDrawerMounted(false), 350);
  };

  const toggleCopilot = () => {
    if (copilotOpen) closeCopilot();
    else openCopilot();
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && copilotOpen) closeCopilot();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [copilotOpen]);

  return (
    <div className="shop-app-shell flex h-full min-h-0 flex-col overflow-hidden relative">
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
            <Breadcrumb onToggleCopilot={toggleCopilot} isCopilotOpen={copilotOpen} />
            <div className="w-full">{children}</div>
          </div>
        </main>
      </div>

      {/* The launcher now lives in the header action row (see TopBarActions). */}

      {/* Backdrop overlay */}
      {drawerMounted && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
            drawerVisible ? "opacity-100 animate-fade-overlay" : "opacity-0"
          )}
          onClick={closeCopilot}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Radius Copilot Drawer */}
      {drawerMounted && (
        <div
          id="radius-copilot-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Radius AI Copilot"
          tabIndex={-1}
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-lg",
            "bg-[#080c14]/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl",
            "flex flex-col outline-none",
            "transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            drawerVisible ? "translate-x-0" : "translate-x-full"
          )}
        >
          <RadiusCopilot onClose={closeCopilot} />
        </div>
      )}
    </div>
  );
}
