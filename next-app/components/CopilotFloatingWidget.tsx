"use client";

import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { RadiusCopilot } from "@/components/RadiusCopilot";
import { Button } from "@/components/ui/button";

export default function CopilotFloatingWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating launcher trigger */}
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 px-4 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 border border-violet-400/30"
        >
          <Sparkles className="h-5 w-5 animate-pulse text-amber-300" />
          <span>AI Copilot</span>
        </Button>
      )}

      {/* Floating Copilot Dialog */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[460px] h-[580px] rounded-2xl border border-violet-500/30 bg-card shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent px-4 py-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span>RADIUS AI Copilot</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <RadiusCopilot onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
