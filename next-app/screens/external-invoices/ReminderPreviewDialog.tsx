import { BellRing, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildReminderMessagePreview } from "@/lib/externalInvoiceInsights";
import type { ExternalInvoice } from "@/types/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ExternalInvoice[];
  isSending: boolean;
  onConfirm: () => void;
};

export const ReminderPreviewDialog = ({ open, onOpenChange, targets, isSending, onConfirm }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          Send WhatsApp reminder{targets.length > 1 ? "s" : ""}
        </DialogTitle>
        <DialogDescription>
          {targets.length === 1
            ? "Review the message preview before sending to the customer."
            : `You are about to send ${targets.length} reminders. Preview shows the first invoice.`}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        {targets.length > 1 ? (
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</div>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
              {targets.slice(0, 12).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">#{inv.id} · {inv.username || inv.fullName || "—"}</span>
                  <span className="shrink-0 text-muted-foreground">${Number(inv.amount ?? 0).toLocaleString()}</span>
                </li>
              ))}
              {targets.length > 12 ? (
                <li className="text-muted-foreground">+ {targets.length - 12} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {targets[0] ? (
          <div className="overflow-hidden rounded-xl border border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 border-b border-emerald-200/60 bg-emerald-100/60 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              <MessageCircle className="h-3.5 w-3.5" />
              Message preview
            </div>
            <div className="whitespace-pre-wrap p-3 text-xs leading-relaxed text-foreground/90">
              {buildReminderMessagePreview(targets[0])}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          The actual WhatsApp text is defined by your Twilio reminder template (not this preview).
        </p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          onClick={onConfirm}
          disabled={isSending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <BellRing className="mr-2 h-4 w-4" />
              Send {targets.length > 1 ? `${targets.length} reminders` : "reminder"}
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
