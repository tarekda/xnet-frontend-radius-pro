import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Download,
  Loader2,
  MessageCircle,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import IconActionButton from "@/components/IconActionButton";

type Props = {
  selectedCount: number;
  canPay: boolean;
  isBulkPaidInProgress: boolean;
  isReminderDisabled: boolean;
  isWorkflowPending: boolean;
  isBulkUpdatePending: boolean;
  isBulkDeletePending: boolean;
  isExportingAll: boolean;
  onMarkPaid: () => void;
  onSendReminders: () => void;
  onEscalate: () => void;
  onSetPayDue: () => void;
  onPromiseToPay: () => void;
  onExportSelected: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export const BulkActionsBar = ({
  selectedCount,
  canPay,
  isBulkPaidInProgress,
  isReminderDisabled,
  isWorkflowPending,
  isBulkUpdatePending,
  isBulkDeletePending,
  isExportingAll,
  onMarkPaid,
  onSendReminders,
  onEscalate,
  onSetPayDue,
  onPromiseToPay,
  onExportSelected,
  onDelete,
  onClearSelection,
}: Props) => (
  <Card className="sticky top-2 z-10 overflow-hidden border-primary/20 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-violet-50/50 shadow-md dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/20">
    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">
            {selectedCount} invoice{selectedCount > 1 ? "s" : ""} selected
          </div>
          <div className="text-xs text-muted-foreground">
            Bulk actions apply to the current page selection
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {canPay ? (
          <IconActionButton
            label={isBulkPaidInProgress ? "Marking paid…" : "Mark paid"}
            onClick={onMarkPaid}
            disabled={isBulkPaidInProgress}
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            icon={isBulkPaidInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          />
        ) : null}
        <IconActionButton
          label="WhatsApp reminder"
          onClick={onSendReminders}
          disabled={isReminderDisabled}
          className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <IconActionButton
          label="Escalate"
          onClick={onEscalate}
          disabled={isWorkflowPending}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <IconActionButton
          label="Set pay due"
          onClick={onSetPayDue}
          disabled={isBulkUpdatePending}
          icon={<Calendar className="h-4 w-4" />}
        />
        <IconActionButton
          label="Promise to pay"
          onClick={onPromiseToPay}
          disabled={isWorkflowPending}
          icon={<Calendar className="h-4 w-4" />}
        />
        <IconActionButton
          label="Export"
          onClick={onExportSelected}
          disabled={isExportingAll}
          icon={<Download className="h-4 w-4" />}
        />
        <IconActionButton
          label="Delete"
          onClick={onDelete}
          disabled={isBulkDeletePending || isBulkPaidInProgress}
          variant="destructive"
          icon={<Trash2 className="h-4 w-4" />}
        />
        <IconActionButton
          label="Clear"
          onClick={onClearSelection}
          variant="ghost"
          icon={<X className="h-4 w-4" />}
        />
      </div>
    </CardContent>
  </Card>
);
