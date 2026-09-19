import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/PageHeader";
import QueryState from "@/components/QueryState";
import TicketDetailDialog from "@/components/TicketDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_SOURCES,
  TICKET_SOURCE_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  relativeTimeFrom,
  slaCountdown,
} from "@/lib/ticketMeta";
import { useCreateTicket, useTickets } from "@/hooks/useTickets";
import type {
  TicketCategory,
  TicketInput,
  TicketPriority,
  TicketSource,
} from "@/api/tickets";
import { AlertTriangle, Loader2, LifeBuoy, Plus, Search } from "lucide-react";

/** Sentinel for "no filter" — Radix Select rejects an empty item value. */
const ANY = "__any";

const PAGE_SIZE = 25;

type CreateFormState = {
  subject: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  source: TicketSource;
  requester: string;
  assignee: string;
};

const EMPTY_FORM: CreateFormState = {
  subject: "",
  description: "",
  priority: "normal",
  category: "other",
  source: "phone",
  requester: "",
  assignee: "",
};

function CreateTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createMutation = useCreateTicket();
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);

  const submit = () => {
    const payload: TicketInput = {
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      category: form.category,
      source: form.source,
      requester: form.requester.trim() || null,
      assignee: form.assignee.trim() || null,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        onCreated();
        onClose();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setForm(EMPTY_FORM);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>
            The SLA clock starts immediately, based on the priority you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-ticket-subject">Subject</Label>
            <Input
              id="new-ticket-subject"
              value={form.subject}
              placeholder="No internet since this morning"
              onChange={(event) =>
                setForm((previous) => ({ ...previous, subject: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-ticket-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  setForm((previous) => ({ ...previous, priority: value as TicketPriority }))
                }
              >
                <SelectTrigger id="new-ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {TICKET_PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-ticket-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((previous) => ({ ...previous, category: value as TicketCategory }))
                }
              >
                <SelectTrigger id="new-ticket-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {TICKET_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-ticket-source">Source</Label>
              <Select
                value={form.source}
                onValueChange={(value) =>
                  setForm((previous) => ({ ...previous, source: value as TicketSource }))
                }
              >
                <SelectTrigger id="new-ticket-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {TICKET_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-ticket-requester">Subscriber username</Label>
              <Input
                id="new-ticket-requester"
                value={form.requester}
                placeholder="optional"
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, requester: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-ticket-assignee">Assign to</Label>
              <Input
                id="new-ticket-assignee"
                value={form.assignee}
                placeholder="optional username"
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, assignee: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-ticket-description">Description</Label>
            <Textarea
              id="new-ticket-description"
              value={form.description}
              placeholder="What did the subscriber report?"
              onChange={(event) =>
                setForm((previous) => ({ ...previous, description: event.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={createMutation.isPending || !form.subject.trim()}
          >
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TicketsPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canManage = can(user, "support.tickets.manage");

  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>(ANY);
  const [search, setSearch] = useState("");
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);

  const params = useMemo(
    () => ({
      status: statusFilter,
      priority: priorityFilter === ANY ? undefined : priorityFilter,
      search: search.trim() || undefined,
      breachedOnly: breachedOnly || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [statusFilter, priorityFilter, search, breachedOnly, page]
  );

  const ticketsQuery = useTickets(params);
  const result = ticketsQuery.data?.data;
  const tickets = result?.data ?? [];
  const metrics = result?.metrics;

  const metricChips: Array<{ key: string; label: string; value: number; tone?: string }> = [
    { key: "open", label: "Open", value: metrics?.open ?? 0 },
    { key: "in_progress", label: "In progress", value: metrics?.inProgress ?? 0 },
    { key: "waiting", label: "Waiting", value: metrics?.waiting ?? 0 },
    { key: "resolved", label: "Resolved", value: metrics?.resolved ?? 0 },
    { key: "breached", label: "SLA breached", value: metrics?.breached ?? 0, tone: "danger" },
  ];

  const resetTo = (next: () => void) => {
    next();
    setPage(1);
  };

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("tickets.title")}
        subtitle={t("tickets.subtitle")}
        icon={LifeBuoy}
        actions={
          canManage ? (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New ticket
            </Button>
          ) : null
        }
      />

      {/* Queue metrics double as quick filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metricChips.map((chip) => {
          const isActive =
            chip.key === "breached"
              ? breachedOnly
              : statusFilter === chip.key && !breachedOnly;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                resetTo(() => {
                  if (chip.key === "breached") {
                    setBreachedOnly((previous) => !previous);
                  } else {
                    setBreachedOnly(false);
                    setStatusFilter(statusFilter === chip.key ? "active" : chip.key);
                  }
                })
              }
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card/70 hover:border-primary/25 hover:bg-muted/40"
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {chip.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-xl font-semibold tabular-nums",
                  chip.tone === "danger" && chip.value > 0 ? "text-destructive" : ""
                )}
              >
                {chip.value}
              </div>
            </button>
          );
        })}
      </div>

      <Card className="glass-card">
        <CardHeader className="border-b border-border/50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder="Search subject, description or subscriber…"
                className="pl-9"
                onChange={(event) => resetTo(() => setSearch(event.target.value))}
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onValueChange={(value) => resetTo(() => setStatusFilter(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (not closed)</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TICKET_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-40">
              <Select
                value={priorityFilter}
                onValueChange={(value) => resetTo(() => setPriorityFilter(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any priority</SelectItem>
                  {TICKET_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {TICKET_PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 pb-1 text-sm text-muted-foreground">
              <Switch
                checked={breachedOnly}
                onCheckedChange={(checked) => resetTo(() => setBreachedOnly(checked))}
              />
              Breached only
            </label>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <QueryState
            isLoading={ticketsQuery.isLoading}
            error={ticketsQuery.error}
            isEmpty={!ticketsQuery.isLoading && !ticketsQuery.error && tickets.length === 0}
            onRetry={() => ticketsQuery.refetch()}
            skeletonType="table"
            errorTitle="Failed to load tickets"
            emptyTitle="No tickets match these filters"
            emptyDescription="Adjust the filters, or create a ticket to get started."
          >
            <div className="w-full overflow-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Resolution SLA</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer"
                      onClick={() => setOpenTicketId(ticket.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ticket.id}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{ticket.subject}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {TICKET_CATEGORY_LABELS[ticket.category]}
                          </Badge>
                          <span>{TICKET_SOURCE_LABELS[ticket.source]}</span>
                          {ticket.requester ? <span>· {ticket.requester}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", TICKET_PRIORITY_TONES[ticket.priority])}>
                          {TICKET_PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", TICKET_STATUS_TONES[ticket.status])}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ticket.assignee || "—"}</TableCell>
                      <TableCell>
                        {ticket.resolvedAt ? (
                          <span className="text-sm text-muted-foreground">Resolved</span>
                        ) : ticket.slaBreachedAt ? (
                          <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Breached
                          </span>
                        ) : (
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {slaCountdown(ticket.resolveDueAt)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {relativeTimeFrom(ticket.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </QueryState>

          {result && result.totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {result.page} of {result.totalPages} · {result.total.toLocaleString()} ticket
                {result.total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.totalPages}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CreateTicketDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => setPage(1)}
      />

      <TicketDetailDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
    </div>
  );
}
