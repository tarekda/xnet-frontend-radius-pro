"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  Clock,
  Trash2,
} from "lucide-react";

interface AIAgentSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSimulationComplete?: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  intent?: string;
  matchedUsername?: string | null;
  delivered?: boolean;
}

const SAMPLE_QUERIES = [
  { label: "📋 Multi-Line: Ahmad 35, Sarah 40", text: "Ahmad Khalil 35\nSarah Mansour 40\nCharbel Haddad 50", intent: "batch_payment" },
  { label: "💵 Single Name: Ali Hassan 25$", text: "Ali Hassan 25$", intent: "batch_payment" },
  { label: "💳 Prefix: paid: user123 30", text: "paid: user123 30", intent: "batch_payment" },
  { label: "💵 Lebanese: Adde 3laye?", text: "Adde 3laye hal shaher?", intent: "bill_inquiry" },
  { label: "💳 Franco: Kif bedfa3?", text: "Baddi edfa3 kif tari2a?", intent: "how_to_pay" },
  { label: "📊 Lebanese: Ade ba2e quota?", text: "Ade ba2e ma3e quota?", intent: "quota_inquiry" },
  { label: "🌐 English: Check balance", text: "Hello, please check my bill and due balance", intent: "bill_inquiry" },
  { label: "⚡ Refresh Connection", text: "Internet is slow or disconnected, please refresh my line", intent: "refresh_connection" },
  { label: "👥 Human Support", text: "Baddi ehke ma3 customer service", intent: "agent_escalation" },
  { label: "🚀 Boost: baddi topup 50GB", text: "baddi topup 50GB", intent: "topup_inquiry" },
  { label: "📦 View Extra Packs", text: "baddi zide gigayete", intent: "topup_inquiry" },
  { label: "6️⃣ Shortcut: 6 (Boost)", text: "6", intent: "topup_inquiry" },
  { label: "1️⃣ Shortcut: 1 (Bill)", text: "1", intent: "bill_inquiry" },
  { label: "2️⃣ Shortcut: 2 (Pay)", text: "2", intent: "how_to_pay" },
];

export function AIAgentSimulatorModal({
  open,
  onOpenChange,
  onSimulationComplete,
}: AIAgentSimulatorModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("+96170882190");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-bot",
      sender: "bot",
      text: "👋 Welcome to XNet Automated Billing Assistant!\nI can check your unpaid invoices, guide you through Whish / OMT payment, check your quota, or refresh your line.\n\nType your question in Lebanese Arabic, Franco, or English!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText("");
    setIsSending(true);

    try {
      const response = await apiClient.post("/invoices/external/whatsapp/simulate", {
        fromNumber: phoneNumber.trim(),
        message: query,
      });

      const resData = response?.data?.data;
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: resData?.replyText || "No response received from agent.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        intent: resData?.intent,
        matchedUsername: resData?.subscriber?.username,
        delivered: resData?.delivered,
      };

      setMessages((prev) => [...prev, botMsg]);
      notify.success("AI Agent Processed", `Intent classified: ${resData?.intent || "unknown"}`);

      // If simulated payment resulted in paid invoices, trigger the bottom-left dock queue immediately
      if (typeof window !== "undefined" && Array.isArray(resData?.paymentResult?.results)) {
        for (const r of resData.paymentResult.results) {
          if (r.status === "paid" && Array.isArray(r.paidInvoiceIds) && r.paidInvoiceIds.length > 0) {
            window.dispatchEvent(
              new CustomEvent("xnet:whatsapp_inbound_paid", {
                detail: {
                  source: "whatsapp_inbound",
                  invoiceId: r.paidInvoiceIds[0],
                  fullName: r.name,
                  amount: r.amount ?? 0,
                  matchedName: r.name,
                },
              })
            );
          }
        }
      }

      onSimulationComplete?.();
    } catch (err: any) {
      notify.error("Simulation Failed", err?.message || "Failed to reach AI billing agent");
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "initial-bot-fresh",
        sender: "bot",
        text: "👋 Chat reset. Ask a question or click any prompt shortcut below!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/70 shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  Conversational AI Billing Agent Simulator
                  <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    P2 Live Agent
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Simulate WhatsApp inbound inquiries in Lebanese Arabic, Franco, and English with live database matching.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Clear chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </DialogHeader>

        {/* Sender Phone Control Bar */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Simulated Phone:
            </span>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              aria-label="Simulated sender phone number"
              className="h-7 w-[160px] font-mono text-xs"
              placeholder="+961..."
            />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Presets:</span>
            <button
              type="button"
              onClick={() => setPhoneNumber("+96170882190")}
              className="hover:text-primary underline cursor-pointer"
            >
              +961 70 882190
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setPhoneNumber("+96103551229")}
              className="hover:text-primary underline cursor-pointer"
            >
              +961 03 551229
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setPhoneNumber("+96171999999")}
              className="hover:text-primary underline cursor-pointer"
            >
              Guest (No Match)
            </button>
          </div>
        </div>

        {/* Chat Thread Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[300px] max-h-[420px] bg-background/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1.5 shadow-xs ${
                  m.sender === "user"
                    ? "bg-emerald-600 text-white rounded-br-xs"
                    : "bg-muted/70 border border-border/60 text-foreground rounded-bl-xs"
                }`}
              >
                {/* Meta Badges for Bot */}
                {m.sender === "bot" && (m.intent || m.matchedUsername) && (
                  <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-border/40 mb-1">
                    {m.intent && (
                      <Badge
                        variant="outline"
                        className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      >
                        Intent: {m.intent}
                      </Badge>
                    )}
                    {m.matchedUsername ? (
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      >
                        👤 {m.matchedUsername}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">
                        No user match
                      </Badge>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed font-sans">{m.text}</div>

                <div
                  className={`text-[10px] flex items-center justify-end gap-1 ${
                    m.sender === "user" ? "text-emerald-100" : "text-muted-foreground"
                  }`}
                >
                  <Clock className="h-2.5 w-2.5" />
                  <span>{m.timestamp}</span>
                  {m.sender === "bot" && (
                    <span className="text-emerald-500 ml-1">✓ Delivered</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-muted/70 border border-border/60 rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                <span>AI Billing Agent is processing inquiry...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Query Chips */}
        <div className="p-3 border-t border-border/40 bg-muted/20 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Quick Lebanese NLP Test Prompts:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(sq.text)}
                disabled={isSending}
                className="text-[11px] px-2.5 py-1 rounded-full bg-background border border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Send Bar */}
        <div className="p-3 border-t border-border/50 bg-background flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            aria-label="WhatsApp message to simulate"
            placeholder="Type WhatsApp message (e.g. 'Adde 3laye fatora?', 'How can I pay?')..."
            className="text-xs flex-1"
            disabled={isSending}
          />
          <Button
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={isSending || !inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-xs shrink-0"
          >
            {isSending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Simulate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
