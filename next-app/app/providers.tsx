"use client";

import CommandPalette from "@/components/CommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/Sidebar/Sidebar.context";
import { AppPreferencesProvider } from "@/context/AppPreferencesContext";
import { AuthProvider } from "@/context/AuthContext";
import i18n from "@/i18n/config";
import { initTelemetry } from "@/lib/telemetry";
import { websocketService } from "@/services/websocket";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    initTelemetry();
  }, []);

  useEffect(() => {
    websocketService.connect();
    return () => websocketService.disconnect();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="flex h-full min-h-0 flex-col">
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <AppPreferencesProvider>
                <SidebarProvider>
                  <AuthProvider>
                    <KeyboardShortcutsDialog />
                    <CommandPalette />
                    {children}
                  </AuthProvider>
                </SidebarProvider>
              </AppPreferencesProvider>
            </div>
          </ErrorBoundary>
        </QueryClientProvider>
        <Toaster />
      </div>
    </I18nextProvider>
  );
}
