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
import { Bot } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { density } = useAppPreferences();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            <Breadcrumb />
            <div className="w-full">{children}</div>
          </div>
        </main>
      </div>

      {/* Floating AI Copilot FAB — breathing glow pulse */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          id="radius-copilot-fab"
          onClick={toggleCopilot}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-full text-white text-xs font-bold",
            "bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500",
            "hover:from-indigo-500 hover:to-sky-400",
            "border border-indigo-400/40",
            "hover:scale-105 active:scale-95 transition-all duration-200",
            "animate-glow-pulse",
            copilotOpen && "from-indigo-700 to-sky-600 scale-105"
          )}
          title="Open Radius AI Network Ops Copilot"
          aria-expanded={copilotOpen}
          aria-controls="radius-copilot-drawer"
        >
          <Bot className="w-4 h-4 text-white" />
          <span className="font-semibold tracking-wide">AI Copilot</span>
          <span className={cn("w-2 h-2 rounded-full", copilotOpen ? "bg-sky-300" : "bg-emerald-400 animate-pulse")} />
        </button>
      </div>

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
          role="dialog"
          aria-modal="true"
          aria-label="Radius AI Copilot"
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-lg",
            "bg-[#080c14]/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl",
            "flex flex-col",
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
