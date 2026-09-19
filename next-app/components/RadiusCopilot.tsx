"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  User,
  RefreshCw,
  Cpu,
  Check,
  Image as ImageIcon,
  Trash2,
  Brain,
  X,
  Copy,
  Terminal,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentImage?: string;
  timestamp: string;
}

interface RadiusCopilotProps {
  initialPrompt?: string;
  activeContext?: string;
  onClose?: () => void;
}

const QUICK_PROMPTS = [
  "⚡ Diagnose recent Auth Failures & Lockouts",
  "🚀 Generate MikroTik Queue & Burst profile",
  "📡 Audit NAS ping latency & packet drops",
  "🔍 Identify top bandwidth hogs & quota cycle",
  "🛡️ Generate FreeRADIUS rate-limit policy",
];

const STORAGE_KEY = "radius_copilot_history_v1";
const MAX_HISTORY = 20;

function loadHistory(): CopilotMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CopilotMessage[];
      return parsed.slice(-MAX_HISTORY).map((m) => ({ ...m, attachmentImage: undefined }));
    }
  } catch {}
  return [];
}

function saveHistory(messages: CopilotMessage[]) {
  try {
    const stripped = messages.slice(-MAX_HISTORY).map((m) => ({ ...m, attachmentImage: undefined }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch {}
}

function makeWelcome(): CopilotMessage {
  return {
    id: "msg_init",
    role: "assistant",
    content: `👋 **Radius AI Network Ops Copilot — Online**\n\nI specialize in ISP network architecture, AAA authentication, and MikroTik RouterOS infrastructure:\n- 🛡️ **RADIUS Auth Diagnostics** (Reject codes, MAC mismatch, Simultaneous-Use)\n- ⚡ **MikroTik RouterOS Scripting** (Queues, PPPoE, Firewall, Burst policies)\n- 📡 **Telemetry & Latency Audit** (Packet drops, gateway latency, jitter)\n- 💳 **Dunning & Voucher Ops** (Billing cycles, quota limiters)\n- 🧠 **Extended Thinking Engine** enabled for complex network troubleshooting\n\nHow can I assist your network operations?`,
    timestamp: new Date().toISOString(),
  };
}

// ─── Lightweight Markdown Renderer ───────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={`code-${i}`} className="my-2 rounded-lg overflow-hidden border border-slate-700/60 bg-[#0d1117]">
          {lang && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{lang}</span>
              <Terminal className="h-3 w-3 text-slate-500" />
            </div>
          )}
          <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed">
            <code className="text-emerald-300 font-mono whitespace-pre">
              {codeLines.join("\n")}
            </code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Heading H3
    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={`h3-${i}`} className="mt-3 mb-1 text-xs font-bold text-indigo-300 uppercase tracking-wider">
          {inlineMarkdown(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Heading H2
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={`h2-${i}`} className="mt-3 mb-1 text-sm font-bold text-slate-100">
          {inlineMarkdown(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Table row
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((r) => !r.match(/^\|[\s:-]+\|/))
        .map((r) =>
          r.split("|").slice(1, -1).map((cell) => cell.trim())
        );
      if (rows.length > 0) {
        nodes.push(
          <div key={`table-${i}`} className="my-2 overflow-x-auto rounded-lg border border-slate-700/60">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/60">
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="px-2.5 py-1.5 text-left text-slate-300 font-semibold whitespace-nowrap">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2.5 py-1.5 text-slate-300">{inlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (line.match(/^(\s*)[-*]\s+/)) {
      const items: string[] = [];
      const indent = (line.match(/^(\s*)/) || ["", ""])[1].length;
      while (i < lines.length && lines[i].match(/^(\s*)[-*]\s+/) && (lines[i].match(/^(\s*)/) || ["", ""])[1].length === indent) {
        items.push(lines[i].replace(/^(\s*)[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-0.5 pl-3">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-[11px] text-slate-200">
              <span className="mt-1 h-1 w-1 rounded-full bg-indigo-400 shrink-0" />
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1.5 space-y-0.5 pl-3">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-[11px] text-slate-200">
              <span className="mt-0.5 text-[10px] font-bold text-indigo-400 shrink-0 font-mono">{ii + 1}.</span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      nodes.push(<hr key={`hr-${i}`} className="my-2 border-slate-700/60" />);
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="text-[11px] leading-relaxed text-slate-200">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

/** Renders bold, italic, inline code within a line */
function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={match.index} className="font-bold text-slate-100">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={match.index} className="rounded bg-slate-700/70 border border-slate-600/50 px-1 py-0.5 text-[10px] font-mono text-emerald-300">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={match.index} className="italic text-slate-300">{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

// ─── Thinking Dots Animation ──────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// ─── Auto-grow Textarea ───────────────────────────────────────────────────────
function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  maxRows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  maxRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineH = 20;
    const maxH = lineH * maxRows + 16;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, [value, maxRows]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 resize-none overflow-y-auto bg-background text-xs text-foreground placeholder-muted-foreground border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 leading-5 max-h-[100px]"
      style={{ minHeight: "36px" }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const RadiusCopilot: React.FC<RadiusCopilotProps> = ({
  initialPrompt,
  activeContext,
  onClose,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = loadHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      setMessages([makeWelcome()]);
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0 || streamingId) return;
    saveHistory(messages);
  }, [messages, streamingId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Abort stream when drawer closes
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Show scroll-to-bottom button when not at bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 120);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearMemory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([makeWelcome()]);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if ((!text.trim() && !attachedImage) || loading) return;

    const userMsg: CopilotMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text || (attachedImage ? "Please analyze this attached network log or screenshot." : ""),
      attachmentImage: attachedImage || undefined,
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = `msg_ai_${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);
    setInput("");
    setAttachedImage(null);
    setLoading(true);
    setStreamingId(assistantMsgId);
    setIsThinking(false);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg], context: activeContext }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const extendedThinking = res.headers.get("X-Extended-Thinking") === "true";
      if (extendedThinking) setIsThinking(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.meta?.extended_thinking) setIsThinking(true);
            if (parsed.delta) {
              fullContent += parsed.delta;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantMsgId ? { ...m, content: fullContent } : m)
              );
            }
          } catch {}
        }
      }
    } catch {
      if (!abort.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "❌ Error communicating with AI Copilot. Check network connectivity or server logs." }
              : m
          )
        );
      }
    } finally {
      setLoading(false);
      setStreamingId(null);
      setIsThinking(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (initialPrompt && !initialSentRef.current) {
      initialSentRef.current = true;
      handleSend(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const charCount = input.length;
  const charWarn = charCount > 800;

  return (
    <div className="flex flex-col h-full bg-card dark:bg-[#080c14] border-l border-border dark:border-slate-800 shadow-2xl overflow-hidden text-foreground dark:text-slate-100">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 dark:bg-[#0a0e17] border-b border-border/80 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm animate-glow-pulse">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-foreground dark:text-slate-100 flex items-center gap-2">
              Radius AI Network Ops
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="sr-only">Copilot status: online</span>
              {isThinking && (
                <span className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-300 animate-pulse">
                  <Brain className="w-2.5 h-2.5" />
                  Extended Thinking…
                </span>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground dark:text-slate-400 font-mono flex items-center gap-1.5">
              <span>FreeRADIUS</span> · <span>MikroTik RouterOS</span> · <span>Live AAA</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSend("⚡ Perform automated ISP diagnostics: Check auth failure trends, pending dunning accounts, and active NAS load.")}
            disabled={loading}
            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-40"
            title="Auto-Diagnostics"
          >
            <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Auto-Audit</span>
          </button>

          <button
            onClick={clearMemory}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
            title="Clear Chat Memory"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={() => { abortRef.current?.abort(); onClose(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-slate-800 transition-colors"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 p-4 overflow-y-auto space-y-3.5 bg-grid-pattern"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          const isStreaming = streamingId === m.id;
          const isEmpty = isStreaming && m.content.length === 0;

          return (
            <div
              key={m.id}
              className={cn("flex gap-2.5 animate-slide-up", isUser ? "justify-end" : "justify-start")}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[88%] rounded-xl p-3 space-y-1.5 shadow-md",
                  isUser
                    ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-medium shadow-indigo-500/15"
                    : "bg-background/95 dark:bg-[#0d131f]/95 border border-border dark:border-slate-800 backdrop-blur-md"
                )}
              >
                {m.attachmentImage && (
                  <div className="rounded-lg overflow-hidden border border-border dark:border-slate-700/80 bg-muted/50 mb-2 max-h-48">
                    <Image
                      src={m.attachmentImage}
                      alt="Attachment"
                      width={400}
                      height={300}
                      unoptimized
                      className="w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                )}

                {isUser ? (
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-white">{m.content}</div>
                ) : isEmpty ? (
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-[11px] py-1">
                    {isThinking ? (
                      <>
                        <Brain className="w-3.5 h-3.5 animate-pulse" />
                        <span className="text-violet-600 dark:text-violet-300">Extended reasoning on network structure…</span>
                      </>
                    ) : (
                      <>
                        <ThinkingDots />
                        <span className="text-xs">Analyzing AAA records & RouterOS parameters…</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {renderMarkdown(m.content)}
                    {isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-indigo-500 dark:bg-indigo-400 rounded-sm animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                )}

                {/* Actions footer (assistant, done) */}
                {!isUser && !isStreaming && m.content.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-border/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1 font-mono text-[9px]">
                      <Terminal className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                      <span>Xnet AI Engine</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-50">{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(m.content, m.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded bg-muted/60 hover:bg-muted dark:bg-slate-800/60 dark:hover:bg-slate-800 transition-colors"
                      >
                        {copiedId === m.id ? (
                          <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                        ) : (
                          <><Copy className="w-3 h-3" /><span>Copy</span></>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* User timestamp */}
                {isUser && (
                  <div className="text-[9px] text-white/60 text-right font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-300">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 right-5 z-10 flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 animate-scale-in"
        >
          <ChevronDown className="h-3 w-3" />
          New messages
        </button>
      )}

      {/* ── Quick Prompts ── */}
      <div className="px-3 py-2 bg-muted/30 dark:bg-[#0a0e17]/80 border-t border-border/80 dark:border-slate-800/80 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="text-[10px] whitespace-nowrap bg-background hover:bg-muted text-foreground/90 border border-border px-2.5 py-1 rounded-full transition-colors shrink-0 disabled:opacity-40 flex items-center gap-1 shadow-2xs hover:border-primary/30"
          >
            <Sparkles className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* ── Attachment Preview ── */}
      {attachedImage && (
        <div className="px-3 py-1.5 bg-muted/60 dark:bg-slate-900 border-t border-border dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] truncate">
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Image / Log attached</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="text-muted-foreground hover:text-rose-500 p-0.5 transition-colors"
            title="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Input Area ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3 bg-muted/40 dark:bg-[#0a0e17] border-t border-border/80 dark:border-slate-800/80 flex items-end gap-2 shrink-0"
      >
        <label
          className="p-2 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-300 border border-border cursor-pointer transition-colors shrink-0 self-end"
          title="Upload Log or Screenshot"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </label>

        <div className="flex-1 flex flex-col gap-0.5">
          <AutoTextarea
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask Radius AI… (Shift+Enter for new line)"
            disabled={loading}
          />
          {charWarn && (
            <div className="text-right text-[9px] text-amber-500 font-mono pr-1">{charCount} chars</div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || (!input.trim() && !attachedImage)}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40 shadow-md shadow-indigo-600/30 self-end shrink-0 hover:scale-105 active:scale-95"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </form>
    </div>
  );
};
