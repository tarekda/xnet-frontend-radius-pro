"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CloudDownload,
  Database,
  FileText,
  Globe,
  MessageSquare,
  Network,
  Search,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commands = [
    { label: "Users List", category: "Navigation", path: "/users/list", icon: Users, badge: "Main" },
    { label: "External RADIUS Users", category: "Navigation", path: "/external-users", icon: Globe, badge: "Live" },
    { label: "Automatic Provider Import", category: "Navigation", path: "/invoice-upload/myisp", icon: CloudDownload, badge: "Import" },
    { label: "External Invoices & Billing", category: "Navigation", path: "/external-invoices", icon: FileText },
    { label: "NAS Routers & Live Sessions", category: "Navigation", path: "/nas", icon: Network },
    { label: "Network Topology Map", category: "Navigation", path: "/topology", icon: Activity },
    { label: "Analytics & Fleet Reports", category: "Navigation", path: "/analytics", icon: Zap },
    { label: "Voucher Batches", category: "Navigation", path: "/vouchers", icon: Database },
    { label: "WhatsApp Automation Hub", category: "Navigation", path: "/whatsapp-hub", icon: MessageSquare },
    { label: "System Settings", category: "Navigation", path: "/settings", icon: Settings },
  ];

  const filteredCommands = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 sm:max-w-xl overflow-hidden border-border/80 bg-card/95 backdrop-blur shadow-2xl">
        <div className="flex items-center border-b border-border/60 px-4 py-3 bg-muted/20">
          <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type a command or search pages… (Press Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <Badge variant="outline" className="ml-2 shrink-0 text-[10px] font-mono border-border/60">
            Esc
          </Badge>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching pages or actions found for &quot;{query}&quot;.
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.path}
                  type="button"
                  onClick={() => handleSelect(cmd.path)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 group-hover:border-primary/40 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-primary">{cmd.label}</div>
                      <div className="text-[10px] text-muted-foreground">{cmd.category}</div>
                    </div>
                  </div>
                  {cmd.badge && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {cmd.badge}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground bg-muted/10">
          <div className="flex items-center gap-2 font-mono">
            <span className="rounded bg-muted px-1.5 py-0.5 border border-border/60">Ctrl</span>
            <span>+</span>
            <span className="rounded bg-muted px-1.5 py-0.5 border border-border/60">K</span>
            <span>to open anytime</span>
          </div>
          <span>Antigravity RADIUS Enterprise</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
