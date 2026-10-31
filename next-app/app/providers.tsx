"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/Sidebar/Sidebar.context";
import { AppPreferencesProvider } from "@/context/AppPreferencesContext";
import { AuthProvider } from "@/context/AuthContext";
import i18n from "@/i18n/config";
import { initTelemetry } from "@/lib/telemetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

import { DownloadQueueProvider } from "@/context/DownloadQueueContext";
import { DownloadQueueDock } from "@/components/DownloadQueueDock";
import { WhatsAppInboundPaymentProvider } from "@/context/WhatsAppInboundPaymentContext";
import { WhatsAppInboundPaymentDock } from "@/components/WhatsAppInboundPaymentDock";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000, // Keep data fresh for 30s before refetching on mount
        gcTime: 5 * 60 * 1000, // Cache inactive queries for 5 minutes
      },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    initTelemetry();
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
                    <DownloadQueueProvider>
                      <WhatsAppInboundPaymentProvider>
                        <KeyboardShortcutsDialog />
                        {children}
                        <DownloadQueueDock />
                        <WhatsAppInboundPaymentDock />
                      </WhatsAppInboundPaymentProvider>
                    </DownloadQueueProvider>
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
