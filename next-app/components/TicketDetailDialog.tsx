import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import {
  useAddTicketComment,
  useAssignTicket,
  useSetTicketStatus,
  useTicket,
  useUpdateTicket,
} from "@/hooks/useTickets";
import type {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from "@/api/tickets";
import {
  TICKET_CATEGORY_LABELS as CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS as PRIORITY_LABELS,
  TICKET_PRIORITY_TONES as PRIORITY_TONES,
  TICKET_SOURCE_LABELS as SOURCE_LABELS,
  TICKET_STATUS_LABELS as STATUS_LABELS,
  TICKET_STATUS_TONES as STATUS_TONES,
  relativeTimeFrom as relativeTime,
  slaCountdown as untilText,
} from "@/lib/ticketMeta";
import { AlertTriangle, Clock, Loader2, Send, ShieldCheck, User } from "lucide-react";

type Props = {
  ticketId: number | null;
  onClose: () => void;
};

const TicketDetailDialog: React.FC<Props> = ({ ticketId, onClose }) => {
  const { user } = useAuth();
  const canManage = can(user, "support.tickets.manage");

  const detailQuery = useTicket(ticketId);
  const updateMutation = useUpdateTicket();
  const statusMutation = useSetTicketStatus();
  const assignMutation = useAssignTicket();
  const commentMutation = useAddTicketComment();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Ticket>>({});
  const [comment, setComment] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");

  const detail = detailQuery.data?.data;
  const ticket = detail?.ticket ?? null;

  // Reset the local form whenever a different ticket is opened.
  useEffect(() => {
    setIsEditing(false);
    setDraft({});
    setComment("");
    setInternalNote(false);
    setAssigneeInput("");
  }, [ticketId]);

  const isSlaBreached = Boolean(ticket?.slaBreachedAt);
  const responsePending = ticket && !ticket.firstRespondedAt;

  const slaRows = useMemo(() => {
    if (!ticket) return [];
    return [
      {
        label: "First response",
        value: ticket.firstResponseDueAt,
        done: Boolean(ticket.firstRespondedAt),
      },
      { label: "Resolution", value: ticket.resolveDueAt, done: Boolean(ticket.resolvedAt) },
    ];
  }, [ticket]);

  const saveDetails = () => {
    if (!ticket) return;
    updateMutation.mutate(
      {
        id: ticket.id,
        patch: {
          subject: draft.subject ?? ticket.subject,
          description: draft.description ?? ticket.description,
          category: (draft.category ?? ticket.category) as TicketCategory,
          source: (draft.source ?? ticket.source) as TicketSource,
          requester: draft.requester ?? ticket.requester,
        },
      },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const submitComment = () => {
    if (!ticket || !comment.trim()) return;
    commentMutation.mutate(
      { id: ticket.id, body: comment.trim(), visibility: internalNote ? "internal" : "public" },
      { onSuccess: () => setComment("") }
    );
  };

  return (
    <Dialog open={ticketId !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {ticket ? (
              <>
                <span className="text-muted-foreground">#{ticket.id}</span>
                <span>{ticket.subject}</span>
              </>
            ) : (
              "Ticket"
            )}
          </DialogTitle>
          <DialogDescription>
            {ticket
              ? `Raised ${new Date(ticket.createdAt).toLocaleString()} via ${SOURCE_LABELS[ticket.source]}`
              : "Loading the ticket…"}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3 py-6">
            <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ) : detailQuery.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "Could not load the ticket."}
          </div>
        ) : ticket ? (
          <div className="space-y-4">
            {/* Status strip */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border", STATUS_TONES[ticket.status])}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge className={cn("border", PRIORITY_TONES[ticket.priority])}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
              {isSlaBreached ? (
                <Badge className="border border-rose-300 bg-rose-100 text-rose-800">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  SLA breached
                </Badge>
              ) : (
                <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Within SLA
                </Badge>
              )}
            </div>

            {/* SLA clocks */}
            <div className="grid gap-2.5 sm:grid-cols-3">
              {slaRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {row.done ? "Met" : untilText(row.value)}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Owner
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {ticket.assignee || "Unassigned"}
                </div>
              </div>
            </div>

            {/* Controls */}
            {canManage ? (
              <div className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-status">Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={(status) =>
                      statusMutation.mutate({ id: ticket.id, status: status as TicketStatus })
                    }
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger id="ticket-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ticket-priority">Priority</Label>
                  <Select
                    value={ticket.priority}
                    onValueChange={(priority) =>
                      updateMutation.mutate({
                        id: ticket.id,
                        patch: { priority: priority as TicketPriority },
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    <SelectTrigger id="ticket-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ticket-assignee">Assignee</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ticket-assignee"
                      value={assigneeInput || ticket.assignee || ""}
                      placeholder="username"
                      onChange={(event) => setAssigneeInput(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={assignMutation.isPending}
                      onClick={() =>
                        assignMutation.mutate({
                          id: ticket.id,
                          assignee: (assigneeInput || ticket.assignee || "").trim() || null,
                        })
                      }
                    >
                      {assignMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                  {user?.username ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        setAssigneeInput(user.username);
                        assignMutation.mutate({ id: ticket.id, assignee: user.username });
                      }}
                    >
                      Assign to me
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Details */}
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Details</div>
                {canManage ? (
                  isEditing ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveDetails} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  )
                ) : null}
              </div>

              {isEditing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input
                      id="ticket-subject"
                      value={draft.subject ?? ticket.subject}
                      onChange={(event) =>
                        setDraft((previous) => ({ ...previous, subject: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-category">Category</Label>
                    <Select
                      value={(draft.category ?? ticket.category) as string}
                      onValueChange={(value) =>
                        setDraft((previous) => ({
                          ...previous,
                          category: value as TicketCategory,
                        }))
                      }
                    >
                      <SelectTrigger id="ticket-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((category) => (
                          <SelectItem key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-source">Source</Label>
                    <Select
                      value={(draft.source ?? ticket.source) as string}
                      onValueChange={(value) =>
                        setDraft((previous) => ({ ...previous, source: value as TicketSource }))
                      }
                    >
                      <SelectTrigger id="ticket-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((source) => (
                          <SelectItem key={source} value={source}>
                            {SOURCE_LABELS[source]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-requester">Subscriber</Label>
                    <Input
                      id="ticket-requester"
                      value={draft.requester ?? ticket.requester ?? ""}
                      onChange={(event) =>
                        setDraft((previous) => ({ ...previous, requester: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ticket-description">Description</Label>
                    <Textarea
                      id="ticket-description"
                      value={draft.description ?? ticket.description ?? ""}
                      onChange={(event) =>
                        setDraft((previous) => ({ ...previous, description: event.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Subscriber: </span>
                      {ticket.requester || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created by: </span>
                      {ticket.createdBy || "—"}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {ticket.description || "No description provided."}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="text-sm font-semibold">
                Timeline
                {responsePending ? (
                  <Badge variant="outline" className="ml-2 font-normal text-muted-foreground">
                    awaiting first response
                  </Badge>
                ) : null}
              </div>

              {(detail?.comments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No replies yet. Add the first one below.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(detail?.comments ?? []).map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "rounded-xl border px-3 py-2",
                        entry.visibility === "internal"
                          ? "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20"
                          : "border-border/60 bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {entry.author || "system"}
                          {entry.visibility === "internal" ? " · internal note" : ""}
                        </span>
                        <span title={new Date(entry.createdAt).toLocaleString()}>
                          {relativeTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{entry.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {canManage ? (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Textarea
                      value={comment}
                      placeholder={
                        internalNote ? "Internal note (not visible to the customer)" : "Reply…"
                      }
                      onChange={(event) => setComment(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch checked={internalNote} onCheckedChange={setInternalNote} />
                        Internal note
                      </label>
                      <Button
                        size="sm"
                        onClick={submitComment}
                        disabled={!comment.trim() || commentMutation.isPending}
                      >
                        {commentMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {internalNote ? "Add note" : "Send reply"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailDialog;
