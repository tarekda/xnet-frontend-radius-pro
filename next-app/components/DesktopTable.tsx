import React from "react";
import {
  flexRender,
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  RowSelectionState,
  OnChangeFn,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ariaSortFor } from "@/lib/tableA11y";
import {
  AlertCircle,
  CalendarIcon,
  BellRing,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  Eye,
  Mail,
  SlidersHorizontal,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import type { ExternalInvoice } from "@/types/api";
import type { ExternalInvoiceGroup, PaymentLineKind } from "@/lib/externalInvoiceGrouping";
import { HeaderButton } from "./ui/HeaderButton";
import { notify } from "@/lib/notify";
import TableToolbar from "@/components/TableToolbar";
import TablePager from "@/components/TablePager";
import TableRowActions from "@/components/TableRowActions";
import {
  deriveWorkflowStage,
  formatRelativeShort,
  getLastRemindedAt,
  getOverdueDays,
  getOverdueSeverity,
  getWorkflowLabel,
  getWorkflowTone,
  parsePromiseDateFromLastAction,
  type OverdueSeverity,
  type ReconciliationFlag,
  type WorkflowStage,
} from "@/lib/externalInvoiceInsights";

/* ── row tint by overdue severity (open invoices only) ───── */
const severityRowStyles: Record<OverdueSeverity, string> = {
  none: "",
  mild: "border-l-amber-300 bg-amber-50/40 hover:bg-amber-100/60 dark:border-l-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
  moderate:
    "border-l-orange-400 bg-orange-50/50 hover:bg-orange-100/60 dark:border-l-orange-700 dark:bg-orange-950/20 dark:hover:bg-orange-950/30",
  severe:
    "border-l-red-400 bg-red-50/50 hover:bg-red-100/60 dark:border-l-red-800 dark:bg-red-950/20 dark:hover:bg-red-950/30",
  critical:
    "border-l-red-600 bg-red-100/60 hover:bg-red-100/80 dark:border-l-red-600 dark:bg-red-950/35 dark:hover:bg-red-950/45",
};

/* ── colour map for provider pills ───────────────────────── */
const providerStyles = {
  idm: { color: "text-blue-700", bg: "bg-blue-100" },
  isp11s: { color: "text-violet-700", bg: "bg-violet-100" },
  myisp: { color: "text-red-700", bg: "bg-red-100" },
  myisp2: { color: "text-rose-700", bg: "bg-rose-100" },
  terra: { color: "text-blue-700", bg: "bg-blue-100" },
  mobi: { color: "text-blue-700", bg: "bg-blue-100" },
  tisp: { color: "text-orange-700", bg: "bg-orange-100" },
  "tisp-2": { color: "text-green-700", bg: "bg-green-100" },
  default: { color: "text-muted-foreground", bg: "bg-muted/70 dark:bg-muted/50" },
} as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200,500];

type Props = {
  invoices: ExternalInvoice[];
  /* pagination */
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onPageSizeChange: (size: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  totalItems: number;
  /** If true, parent renders the pager (useful for mobile+desktop unified pager). */
  hidePager?: boolean;
  /* selection / sorting */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  /* actions */
  onSetPaid?: (id: number) => void;
  onUnpay?: (id: number) => void;
  onSendReminder?: (id: number) => void;
  onSetWorkflowStage?: (id: number, stage: WorkflowStage) => void;
  onViewInvoice: (inv: ExternalInvoice) => void;
  onDeleteInvoice: (id: number) => void;
  reconciliationMode?: boolean;
  reconciliationFlags?: Map<number, ReconciliationFlag[]>;
  workflowGraceDays?: number;
  /**
   * When provided (keyed by primary invoice id), rows represent merged customer
   * records: payment lines expand beneath, amount shows the outstanding total,
   * pay due date is inherited and the Pay button settles the current-month line.
   */
  groupsById?: Map<number, ExternalInvoiceGroup>;
  /* other */
  search: string;
  key?: number;
  hideBulkActions?: boolean;
};

const LINE_KIND_META: Record<PaymentLineKind, { label: string; className: string }> = {
  current: { label: "Current", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900" },
  due: { label: "Due", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900" },
  debit: { label: "Debit", className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900" },
};

const DesktopTable: React.FC<Props> = ({
  invoices,
  currentPage,
  totalPages,
  pageSize,
  onNextPage,
  onPrevPage,
  onPageSizeChange,
  onFirstPage,
  onLastPage,
  totalItems,
  hidePager = false,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onSetPaid,
  onUnpay,
  onSendReminder,
  onSetWorkflowStage,
  onViewInvoice,
  onDeleteInvoice,
  reconciliationMode,
  reconciliationFlags,
  workflowGraceDays = 7,
  groupsById,
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState<Record<number, boolean>>({});
  const toggleGroup = React.useCallback((id: number) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /* ── column definitions ─────────────────────── */
  const columns = React.useMemo<ColumnDef<ExternalInvoice>[]>(
    () => {
      const cols: ColumnDef<ExternalInvoice>[] = [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <HeaderButton column={column}>ID</HeaderButton>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold pl-4">#{row.original.id}</span>
        ),
      },
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
            className="p-0! ml-0!"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
            className="p-0! ml-0!"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "username",
        header: ({ column }) => (
          <HeaderButton column={column}>Username</HeaderButton>
        ),
        cell: ({ row }) => {
          const group = groupsById?.get(row.original.id);
          const hasLines = (group?.lines.length ?? 0) > 1;
          return (
            <div className="flex items-start gap-1">
              {hasLines ? (
                <button
                  type="button"
                  className="mt-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(row.original.id);
                  }}
                  aria-label={expandedGroups[row.original.id] ? "Collapse payment lines" : "Expand payment lines"}
                >
                  {expandedGroups[row.original.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : null}
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{row.original.username}</span>
                {row.original.debitLabel ? (
                  <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0">
                    {row.original.debitLabel}
                  </Badge>
                ) : null}
                {hasLines ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit cursor-pointer text-[10px] px-1.5 py-0",
                      group && group.openLineCount > 0
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                        : ""
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(row.original.id);
                    }}
                  >
                    {group?.lines.length} lines
                    {group && group.openLineCount > 0 ? ` · ${group.openLineCount} open` : ""}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <HeaderButton column={column}>Full&nbsp;Name</HeaderButton>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-blue-600">{row.original.fullName}</span>
        ),
      },
      {
        accessorKey: "address",
        header: ({ column }) => (
          <HeaderButton column={column}>Address</HeaderButton>
        ),
        cell: ({ row }) => {
          const a = row.original.address;
          if (a === undefined || a === null || String(a).trim() === "") {
            return <span className="text-muted-foreground">—</span>;
          }
          const text = String(a);
          return (
            <span className="max-w-[220px] truncate block text-sm" title={text}>
              {text}
            </span>
          );
        },
      },
      {
        accessorKey: "provider",
        header: ({ column }) => (
          <HeaderButton column={column}>Provider</HeaderButton>
        ),
        cell: ({ row }) => {
          const key = (row.original.provider ?? "").toLowerCase() as keyof typeof providerStyles;
          const { color, bg } = providerStyles[key] ?? providerStyles.default;
          return (
            <span className={`${color} ${bg} px-2 py-1 rounded-full text-xs font-medium`}>
              {row.original.provider}
            </span>
          );
        },
      },
      {
        accessorKey: "paidAt",
        header: ({ column }) => (
          <HeaderButton column={column}>Paid&nbsp;At</HeaderButton>
        ),
        cell: ({ row }) =>
          row.original.paidAt ? (
            <div className="flex items-center">
              <CalendarIcon className="h-4 w-4 text-green-500 mr-1" />
              {new Date(row.original.paidAt).toLocaleString()}
            </div>
          ) : (
            <span className="text-muted-foreground">Not&nbsp;paid</span>
          ),
      },
      {
        id: "paymentVia",
        header: () => <span>Paid&nbsp;via</span>,
        cell: ({ row }) => {
          const inv = row.original as any;
          if (String(inv.status || "").toLowerCase() !== "paid") {
            return <span className="text-muted-foreground">—</span>;
          }
          const method = String(inv.paymentMethod || "").toLowerCase();
          const provider = String(inv.paymentProvider || "").toLowerCase();
          const isWallet = method === "wallet" || provider === "wallet";
          const label = isWallet
            ? "Own wallet"
            : provider === "whish"
              ? "Whish"
              : inv.paymentMethod || inv.paymentProvider || "—";
          const ref = inv.paymentReference ? String(inv.paymentReference) : "";
          return (
            <div className="flex flex-col gap-0.5 min-w-[120px]">
              <span className={`text-xs font-medium ${isWallet ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                {label}
              </span>
              {ref ? (
                <span className="font-mono text-[11px] text-muted-foreground break-all" title={ref}>
                  {ref}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "modifiedBy",
        header: ({ column }) => (
          <HeaderButton column={column}>Last Action</HeaderButton>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.modifiedBy || 'N/A'}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.modifiedAt ? new Date(row.original.modifiedAt).toLocaleString() : "—"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "billingMonth",
        header: ({ column }) => (
          <HeaderButton column={column}>Billing&nbsp;Month</HeaderButton>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 text-muted-foreground mr-1" />
            {new Date(row.original.billingMonth).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </div>
        ),
      },
      {
        accessorKey: "payDueDate",
        header: ({ column }) => (
          <HeaderButton column={column}>Pay&nbsp;due</HeaderButton>
        ),
        cell: ({ row }) => {
          const group = groupsById?.get(row.original.id);
          const raw = group ? (group.inheritedPayDueDate ?? row.original.payDueDate) : row.original.payDueDate;
          if (raw === undefined || raw === null || String(raw).trim() === "") {
            return <span className="text-muted-foreground">—</span>;
          }
          const ymd = String(raw).slice(0, 10);
          const inherited =
            group && group.inheritedPayDueDate && group.inheritedPayDueDate !== String(row.original.payDueDate ?? "").slice(0, 10);
          return (
            <span className="text-sm font-medium" title={inherited ? "Inherited from most recent due payment date" : undefined}>
              {ymd}
            </span>
          );
        },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <HeaderButton column={column}>Amount</HeaderButton>
        ),
        cell: ({ row }) => {
          const group = groupsById?.get(row.original.id);
          const hasLines = (group?.lines.length ?? 0) > 1;
          if (hasLines && group) {
            const showOutstanding = group.outstandingTotal > 0;
            return (
              <div className="flex flex-col">
                <div className="flex items-center font-semibold">
                  <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                  {(showOutstanding ? group.outstandingTotal : row.original.amount).toFixed(2)}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {showOutstanding ? `total due · ${group.lines.length} lines` : `${group.lines.length} lines`}
                </span>
              </div>
            );
          }
          return (
            <div className="flex items-center font-semibold">
              <DollarSign className="h-4 w-4 text-green-500 mr-1" />
              {row.original.amount.toFixed(2)}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <HeaderButton column={column}>Status</HeaderButton>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const group = groupsById?.get(row.original.id);
          // In merged view, the Pay button settles the current-month invoice line only.
          const payTargetId = group ? group.currentMonthPayable?.id ?? null : row.original.id;
          const canPayHere = Boolean(onSetPaid) && (group ? payTargetId !== null : status !== "paid");

          return (
            <div className="flex items-center gap-2">
              {status === "paid" ? (
                <Badge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1 text-white" />
                  <span className="text-white">Paid</span>
                </Badge>
              ) : status === "pending" ? (
                <Badge variant="outline" className="bg-yellow-500 hover:bg-yellow-600 border-yellow-500">
                  <Clock className="h-3 w-3 mr-1 text-white" />
                  <span className="text-white">Pending</span>
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1 text-white" />
                  <span className="text-white">Unpaid</span>
                </Badge>
              )}

              {canPayHere && payTargetId !== null ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  title={group ? "Pay the current-month invoice" : undefined}
                  onClick={() => onSetPaid?.(payTargetId)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Pay
                </Button>
              ) : null}
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const statusOrder = { paid: 2, pending: 1, unpaid: 0 };
          const a = statusOrder[rowA.original.status as keyof typeof statusOrder] ?? 0;
          const b = statusOrder[rowB.original.status as keyof typeof statusOrder] ?? 0;
          return a - b;  // Sort by status priority
        },
      },
      {
        id: "workflow",
        header: () => <span>Workflow</span>,
        cell: ({ row }) => {
          const inv = row.original;
          const stage = deriveWorkflowStage(inv, workflowGraceDays);
          const tone = getWorkflowTone(stage);
          const className =
            tone === "success"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : tone === "destructive"
                ? "bg-red-100 text-red-700 border-red-200"
                : tone === "warning"
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

          const overdueDays = getOverdueDays(inv, workflowGraceDays);
          const showOverdueChip = inv.status !== "paid" && overdueDays > 0;

          const promiseDate = stage === "promise_to_pay" ? parsePromiseDateFromLastAction(inv.lastAction) : null;
          let promiseChip: { label: string; broken: boolean } | null = null;
          if (promiseDate) {
            const daysLeft = Math.ceil(
              (new Date(`${promiseDate}T23:59:59`).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
            );
            promiseChip = daysLeft >= 0
              ? { label: `Promise in ${daysLeft}d`, broken: false }
              : { label: `Promise broken ${Math.abs(daysLeft)}d`, broken: true };
          }

          const remindedAt = inv.status !== "paid" ? getLastRemindedAt(inv) : null;

          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant="outline" className={className}>
                {getWorkflowLabel(stage)}
              </Badge>
              {showOverdueChip ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    overdueDays > 60
                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : overdueDays > 30
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  )}
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  {overdueDays}d overdue
                </span>
              ) : null}
              {promiseChip ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    promiseChip.broken
                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                  )}
                >
                  <CalendarIcon className="h-2.5 w-2.5" />
                  {promiseChip.label}
                </span>
              ) : null}
              {remindedAt ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  title={remindedAt.toLocaleString()}
                >
                  <BellRing className="h-2.5 w-2.5" />
                  Reminded {formatRelativeShort(remindedAt)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      ];

      cols.push({
        id: "actions",
        header: () => <div className="text-right pr-2">Actions</div>,
        cell: ({ row }) => {
          const inv = row.original;
          const copyToClipboard = (text: string, label: string) => {
            navigator.clipboard.writeText(text).then(
              () => notify.success("Copied", `${label} copied to clipboard`),
              () => notify.error("Copy failed", "Could not copy to clipboard")
            );
          };
          return (
            <div className="flex justify-end pr-2">
              <TableRowActions
                actions={[
                  { label: "View details", icon: Eye, onClick: () => onViewInvoice(inv) },
                  { label: "Copy Invoice ID", icon: Copy, onClick: () => copyToClipboard(String(inv.id), "Invoice ID") },
                  { label: "Copy Username", icon: User, onClick: () => copyToClipboard(inv.username, "Username") },
                  ...(inv.email
                    ? [
                        {
                          label: "Send Email",
                          icon: Mail,
                          onClick: () => window.open(`mailto:${inv.email}?subject=Invoice%20%23${inv.id}%20Payment%20Reminder`, "_blank"),
                        },
                      ]
                    : []),
                  ...(onSetPaid
                    ? [
                        {
                          label: "Set as Paid",
                          icon: Check,
                          onClick: () => onSetPaid(inv.id),
                          disabled: inv.status === "paid",
                        },
                      ]
                    : []),
                  ...(onSendReminder
                    ? [
                        {
                          label: "Send Reminder",
                          icon: BellRing,
                          onClick: () => onSendReminder(inv.id),
                        },
                      ]
                    : []),
                  ...(onSetWorkflowStage
                    ? [
                        {
                          label: "Set Stage: Reminded",
                          icon: Clock,
                          onClick: () => onSetWorkflowStage(inv.id, "reminded"),
                        },
                        {
                          label: "Set Stage: Escalated",
                          icon: AlertCircle,
                          onClick: () => onSetWorkflowStage(inv.id, "escalated"),
                        },
                      ]
                    : []),
                  ...(onUnpay
                    ? [
                        {
                          label: "Unpay",
                          icon: XCircle,
                          onClick: () => onUnpay(inv.id),
                          disabled: inv.status !== "paid",
                          tone: "destructive" as const,
                        },
                      ]
                    : []),
                  { label: "Delete", icon: Trash2, onClick: () => onDeleteInvoice(inv.id), tone: "destructive" as const },
                ]}
              />
            </div>
          );
        },
      });

      return cols;
    },
    [onSetPaid, onSendReminder, onSetWorkflowStage, onUnpay, onViewInvoice, onDeleteInvoice, workflowGraceDays, groupsById, expandedGroups, toggleGroup]
  );

  /* ── table instance ───────────────────────── */
  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, rowSelection },
    // Use stable IDs so selection keys are invoice IDs (not row indexes)
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange,
    enableRowSelection: true,
    onRowSelectionChange,
    manualPagination: true,
  });

  /* ── persist column visibility + density ───── */
  React.useEffect(() => {
    const storedCols = localStorage.getItem('extInv.columns');
    if (storedCols) {
      try {
        const vis = JSON.parse(storedCols) as Record<string, boolean>;
        table.setColumnVisibility(vis);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    localStorage.setItem('extInv.columns', JSON.stringify(table.getState().columnVisibility));
  }, [table.getState().columnVisibility]);

  return (
    <>
      <div className="min-w-[768px]">
        <TableToolbar
          label={`Invoices: ${totalItems.toLocaleString()} • Page ${currentPage} / ${totalPages}`}
          className="border-b"
          right={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const xlsx = await import("xlsx");
                  const visibleCols = table.getAllLeafColumns().filter((c) => c.getIsVisible());
                  const dataToExport = table.getCoreRowModel().rows.map((r) => {
                    const obj: Record<string, unknown> = {};
                    visibleCols.forEach((col) => {
                      const key = col.id;
                      obj[key] = (r.original as unknown as Record<string, unknown>)[key];
                    });
                    return obj;
                  });
                  const ws = xlsx.utils.json_to_sheet(dataToExport);
                  const wb = xlsx.utils.book_new();
                  xlsx.utils.book_append_sheet(wb, ws, "External Invoices");
                  xlsx.writeFile(wb, "external_invoices_view.xlsx");
                }}
              >
                Export view
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[60vh] overflow-auto">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  <div className="px-2 py-2 space-y-2">
                    {table.getAllLeafColumns().map((col) => (
                      <label key={col.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={col.getIsVisible()}
                          onCheckedChange={(v) => col.toggleVisibility(!!v)}
                        />
                        <span className="font-mono text-xs text-muted-foreground">{col.id}</span>
                      </label>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <div className="overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/95 shadow-sm backdrop-blur-sm dark:bg-card/90">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="py-2 px-2" aria-sort={ariaSortFor(header)}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, i) => {
                const isFlagged =
                  reconciliationMode && (reconciliationFlags?.get(row.original.id)?.length ?? 0) > 0;
                const isSelected = row.getIsSelected();
                const severity = getOverdueSeverity(row.original, workflowGraceDays);
                const group = groupsById?.get(row.original.id);
                const isExpanded = Boolean(group && (group.lines.length > 1) && expandedGroups[row.original.id]);
                return (
                  <React.Fragment key={row.id}>
                  <TableRow
                    data-state={isSelected && "selected"}
                    title="Double-click to open details"
                    className={cn(
                      "relative cursor-pointer border-l-[3px] border-l-transparent",
                      "transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out",
                      "hover:z-[2] hover:-translate-y-px hover:border-l-primary/80",
                      "hover:bg-accent/65 hover:shadow-md dark:hover:bg-accent/35 dark:hover:shadow-md",
                      i % 2 ? "bg-muted/35" : "bg-card",
                      !isSelected && !isFlagged && severityRowStyles[severity],
                      isSelected &&
                        "z-[1] border-l-primary bg-primary/45 shadow-sm hover:bg-primary/50 hover:shadow-md data-[state=selected]:bg-primary/45 data-[state=selected]:hover:bg-primary/50 dark:bg-primary/25 dark:hover:bg-primary/35 dark:data-[state=selected]:bg-primary/25",
                      isFlagged &&
                        "bg-amber-50/75 dark:bg-amber-950/35 hover:bg-amber-100/90 dark:hover:bg-amber-950/45",
                      isFlagged && isSelected && "bg-amber-100/85 dark:bg-amber-950/40"
                    )}
                    onDoubleClick={() => onViewInvoice(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-left table-cell">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isExpanded && group ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                        <div className="space-y-1.5 border-l-[3px] border-l-primary/40 px-6 py-3">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Payment lines
                          </div>
                          {group.lines.map(({ invoice: line, kind }) => {
                            const meta = LINE_KIND_META[kind];
                            const canPayLine = Boolean(onSetPaid) && line.status !== "paid";
                            return (
                              <div
                                key={line.id}
                                className={cn(
                                  "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm",
                                  line.id === row.original.id && "border-primary/40"
                                )}
                              >
                                <span className="font-mono text-xs text-muted-foreground">#{line.id}</span>
                                <span className="w-[72px] tabular-nums text-xs">
                                  {new Date(line.billingMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                </span>
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", meta.className)}>
                                  {meta.label}
                                </Badge>
                                {line.debitLabel ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {line.debitLabel}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">primary</span>
                                )}
                                <span className="ml-auto tabular-nums font-semibold">
                                  ${Number(line.amount ?? 0).toFixed(2)}
                                </span>
                                <span className="w-[88px] text-xs text-muted-foreground">
                                  {line.payDueDate ? `due ${String(line.payDueDate).slice(0, 10)}` : "no due date"}
                                </span>
                                {canPayLine ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => onSetPaid?.(line.id)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Pay
                                  </Button>
                                ) : line.status === "paid" ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {!hidePager ? (
        <TablePager
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(p) => {
            if (p <= 1) return onFirstPage();
            if (p >= totalPages) return onLastPage();
            if (p < currentPage) return onPrevPage();
            if (p > currentPage) return onNextPage();
          }}
          onPageSizeChange={onPageSizeChange}
          noun="items"
        />
      ) : null}
    </>
  );
};

/* ── helper for sortable headers ───────────────────────── */
// const HeaderButton: React.FC<{ column: any }> = ({ column, children }) => (
//   <Button
//     variant="ghost"
//     onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
//     className="w-full justify-start hover:bg-gray-100"
//   >
//     {children}
//     <ArrowUpDown className="ml-1 h-4 w-4" />
//   </Button>
// );

export default React.memo(DesktopTable);
