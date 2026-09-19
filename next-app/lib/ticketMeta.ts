import type { TicketCategory, TicketPriority, TicketSource, TicketStatus } from "@/api/tickets";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  network: "Network",
  billing: "Billing",
  installation: "Installation",
  service: "Service",
  other: "Other",
};

export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  email: "Email",
  walk_in: "Walk-in",
  portal: "Portal",
};

/** Badge tint per priority — keeps urgency readable at a glance in a dense table. */
export const TICKET_PRIORITY_TONES: Record<TicketPriority, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700",
  normal: "border-sky-300 bg-sky-100 text-sky-800",
  high: "border-amber-300 bg-amber-100 text-amber-900",
  urgent: "border-rose-300 bg-rose-100 text-rose-800",
};

export const TICKET_STATUS_TONES: Record<TicketStatus, string> = {
  open: "border-sky-300 bg-sky-100 text-sky-800",
  in_progress: "border-indigo-300 bg-indigo-100 text-indigo-800",
  waiting: "border-amber-300 bg-amber-100 text-amber-900",
  resolved: "border-emerald-300 bg-emerald-100 text-emerald-800",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
};

export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];
export const TICKET_PRIORITIES = Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[];
export const TICKET_CATEGORIES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[];
export const TICKET_SOURCES = Object.keys(TICKET_SOURCE_LABELS) as TicketSource[];

/** Human-readable countdown to an SLA deadline. */
export function slaCountdown(value: string | null): string {
  if (!value) return "—";
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "—";

  const diffMs = target - Date.now();
  const overdue = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);

  const label =
    minutes < 60
      ? `${minutes}m`
      : minutes < 60 * 24
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${Math.floor(minutes / (60 * 24))}d ${Math.floor((minutes % (60 * 24)) / 60)}h`;

  return overdue ? `${label} overdue` : `in ${label}`;
}

export function relativeTimeFrom(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / (60 * 24))}d ago`;
}
