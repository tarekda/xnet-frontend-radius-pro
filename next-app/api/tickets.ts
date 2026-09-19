import { apiClient } from "@/api/client";

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory = "network" | "billing" | "installation" | "service" | "other";
export type TicketSource = "phone" | "whatsapp" | "email" | "walk_in" | "portal";
export type TicketCommentVisibility = "public" | "internal";

export type Ticket = {
  id: number;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  source: TicketSource;
  requester: string | null;
  assignee: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaBreachedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketComment = {
  id: number;
  ticketId: number;
  author: string | null;
  body: string;
  visibility: TicketCommentVisibility;
  createdAt: string;
};

export type TicketMetrics = {
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  closed: number;
  breached: number;
};

export type TicketListResult = {
  data: Ticket[];
  total: number;
  page: number;
  totalPages: number;
  metrics: TicketMetrics;
};

export type TicketInput = {
  subject: string;
  description?: string | null;
  priority?: TicketPriority;
  category?: TicketCategory;
  source?: TicketSource;
  requester?: string | null;
  assignee?: string | null;
};

export type TicketListParams = {
  status?: string;
  priority?: string;
  assignee?: string;
  requester?: string;
  search?: string;
  breachedOnly?: boolean;
  page?: number;
  limit?: number;
};

export type SlaPolicyEntry = {
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolveMinutes: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

function buildQuery(params: TicketListParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchTickets(
  params: TicketListParams = {}
): Promise<ApiEnvelope<TicketListResult>> {
  const { data } = await apiClient.get<ApiEnvelope<TicketListResult>>(
    `/tickets${buildQuery(params)}`
  );
  return data;
}

export async function fetchTicket(
  id: number
): Promise<ApiEnvelope<{ ticket: Ticket; comments: TicketComment[] }>> {
  const { data } = await apiClient.get<ApiEnvelope<{ ticket: Ticket; comments: TicketComment[] }>>(
    `/tickets/${id}`
  );
  return data;
}

export async function fetchSlaPolicy(): Promise<ApiEnvelope<SlaPolicyEntry[]>> {
  const { data } = await apiClient.get<ApiEnvelope<SlaPolicyEntry[]>>("/tickets/sla-policy");
  return data;
}

export async function createTicket(input: TicketInput): Promise<ApiEnvelope<Ticket>> {
  const { data } = await apiClient.post<ApiEnvelope<Ticket>>("/tickets", input);
  return data;
}

export async function updateTicket(
  id: number,
  patch: Partial<TicketInput>
): Promise<ApiEnvelope<Ticket>> {
  const { data } = await apiClient.patch<ApiEnvelope<Ticket>>(`/tickets/${id}`, patch);
  return data;
}

export async function assignTicket(
  id: number,
  assignee: string | null
): Promise<ApiEnvelope<Ticket>> {
  const { data } = await apiClient.post<ApiEnvelope<Ticket>>(`/tickets/${id}/assign`, {
    assignee,
  });
  return data;
}

export async function setTicketStatus(
  id: number,
  status: TicketStatus
): Promise<ApiEnvelope<Ticket>> {
  const { data } = await apiClient.post<ApiEnvelope<Ticket>>(`/tickets/${id}/status`, { status });
  return data;
}

export async function addTicketComment(
  id: number,
  input: { body: string; visibility?: TicketCommentVisibility }
): Promise<ApiEnvelope<TicketComment>> {
  const { data } = await apiClient.post<ApiEnvelope<TicketComment>>(
    `/tickets/${id}/comments`,
    input
  );
  return data;
}

export async function runTicketSlaSweep(): Promise<
  ApiEnvelope<{ checked: number; breached: number }>
> {
  const { data } = await apiClient.post<ApiEnvelope<{ checked: number; breached: number }>>(
    "/tickets/sla/run"
  );
  return data;
}
