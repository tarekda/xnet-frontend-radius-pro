import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  fetchSlaPolicy,
  fetchTicket,
  fetchTickets,
  runTicketSlaSweep,
  setTicketStatus,
  updateTicket,
} from "@/api/tickets";
import type { TicketCommentVisibility, TicketInput, TicketListParams, TicketStatus } from "@/api/tickets";
import { notify } from "@/lib/notify";

const TICKETS_KEY = "tickets";

function messageFrom(error: unknown, fallback: string): string {
  const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  if (apiMessage) return apiMessage;
  return error instanceof Error ? error.message : fallback;
}

/** The ticket queue, filtered the same way the API filters it. */
export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: [TICKETS_KEY, params],
    queryFn: () => fetchTickets(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: [TICKETS_KEY, "detail", id],
    queryFn: () => fetchTicket(id as number),
    enabled: typeof id === "number" && Number.isFinite(id),
    staleTime: 10_000,
  });
}

/** Response and resolution targets, used to explain the SLA in the UI. */
export function useSlaPolicy() {
  return useQuery({
    queryKey: [TICKETS_KEY, "sla-policy"],
    queryFn: fetchSlaPolicy,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) => createTicket(input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success("Ticket created", `#${response.data.id} — ${response.data.subject}`);
    },
    onError: (error: unknown) => {
      notify.error("Could not create ticket", messageFrom(error, "Please review the form."));
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TicketInput> }) =>
      updateTicket(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success("Ticket updated", "The changes are saved.");
    },
    onError: (error: unknown) => {
      notify.error("Could not update ticket", messageFrom(error, "Please try again."));
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignee }: { id: number; assignee: string | null }) =>
      assignTicket(id, assignee),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success(
        "Assignment updated",
        response.data.assignee ? `Now owned by ${response.data.assignee}` : "Ticket unassigned"
      );
    },
    onError: (error: unknown) => {
      notify.error("Could not assign", messageFrom(error, "Please try again."));
    },
  });
}

export function useSetTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TicketStatus }) =>
      setTicketStatus(id, status),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success("Status updated", `Ticket is now ${String(response.data.status).replace("_", " ")}`);
    },
    onError: (error: unknown) => {
      notify.error("Could not change status", messageFrom(error, "Please try again."));
    },
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
      visibility,
    }: {
      id: number;
      body: string;
      visibility?: TicketCommentVisibility;
    }) => addTicketComment(id, { body, visibility }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success(
        variables.visibility === "internal" ? "Internal note added" : "Reply added",
        "It stays visible on the ticket timeline."
      );
    },
    onError: (error: unknown) => {
      notify.error("Could not add the comment", messageFrom(error, "Please try again."));
    },
  });
}

export function useRunTicketSlaSweep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runTicketSlaSweep,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [TICKETS_KEY] });
      notify.success(
        "SLA sweep complete",
        `${response.data.breached} ticket(s) newly flagged as breached.`
      );
    },
    onError: (error: unknown) => {
      notify.error("SLA sweep failed", messageFrom(error, "Please try again."));
    },
  });
}
