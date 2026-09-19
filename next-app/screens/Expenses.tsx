import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateRange } from "react-day-picker";
import { useExpenseMonthlyTotals, useExpenses } from "@/hooks/useExpenses";
import { DollarSign, Loader2, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { useTranslation } from "react-i18next";
import TablePager from "@/components/TablePager";
import TableToolbar from "@/components/TableToolbar";
import TableRowActions from "@/components/TableRowActions";
import SearchBar from "@/components/SearchBar";
import FiltersBar from "@/components/FiltersBar";
import QueryState from "@/components/QueryState";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function toYmd(d?: Date) {
  if (!d) return undefined;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type Draft = {
  title: string;
  category: string;
  amount: string;
  currency: string;
  expenseDate: string;
  status: "paid" | "unpaid";
  notes: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  category: "",
  amount: "",
  currency: "USD",
  expenseDate: toYmd(new Date()) || "",
  status: "unpaid",
  notes: "",
});

export default function ExpensesPage() {
  const { t } = useTranslation("screens");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const dateFrom = useMemo(() => toYmd(dateRange?.from), [dateRange?.from]);
  const dateTo = useMemo(() => toYmd(dateRange?.to), [dateRange?.to]);

  const { data, isLoading, error, refetch, createMutation, updateMutation, deleteMutation } = useExpenses({
    page,
    limit,
    search: search.trim() || undefined,
    dateFrom,
    dateTo,
  });

  // For summary cards / dashboard-like totals
  const monthlyTotalsQuery = useExpenseMonthlyTotals({ dateFrom, dateTo });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setIsModalOpen(true);
  };

  const openEdit = (exp: any) => {
    setEditingId(exp.id);
    setDraft({
      title: exp.title || "",
      category: exp.category || "",
      amount: String(exp.amount ?? ""),
      currency: exp.currency || "USD",
      expenseDate: exp.expenseDate || "",
      status: exp.status === "paid" ? "paid" : "unpaid",
      notes: exp.notes || "",
    });
    setIsModalOpen(true);
  };

  const onSave = async () => {
    const title = draft.title.trim();
    if (!title) return notify.error("Validation", MESSAGES.validation.titleRequired);
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount)) return notify.error("Validation", MESSAGES.validation.amountRequired);
    if (!draft.expenseDate) return notify.error("Validation", MESSAGES.validation.expenseDateRequired);

    try {
      if (editingId == null) {
        await createMutation.mutateAsync({
          title,
          category: draft.category.trim() || null,
          amount,
          currency: draft.currency.trim() || "USD",
          expenseDate: draft.expenseDate,
          status: draft.status,
          notes: draft.notes.trim() || null,
        });
      } else {
        await updateMutation.mutateAsync({
          id: editingId,
          input: {
            title,
            category: draft.category.trim() || null,
            amount,
            currency: draft.currency.trim() || "USD",
            expenseDate: draft.expenseDate,
            status: draft.status,
            notes: draft.notes.trim() || null,
          },
        });
      }
      setIsModalOpen(false);
    } catch {
      // Toasts are handled in the hook
    }
  };

  const onDelete = async (id: number) => {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (pendingDeleteId == null) return;
    setConfirmDeleteOpen(false);
    try {
      await deleteMutation.mutateAsync(pendingDeleteId);
    } catch {
      // Toasts are handled in the hook
    } finally {
      setPendingDeleteId(null);
    }
  };

  const rows = data?.data?.data || [];
  const totalItems = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;

  const renderRowActions = (exp: any) => (
    <TableRowActions
      actions={[
        { label: "Edit", icon: Pencil, onClick: () => openEdit(exp) },
        {
          label: "Delete",
          icon: Trash2,
          onClick: () => onDelete(exp.id),
          disabled: deleteMutation.isPending,
          tone: "destructive",
        },
      ]}
    />
  );

  const monthlyTotals = monthlyTotalsQuery.data?.data || [];
  const currentMonth = new Date();
  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthTotal = monthlyTotals.find((m) => m.month === currentMonthKey);
  const totalInRange = monthlyTotals.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const currency = (currentMonthTotal?.currency || monthlyTotals[0]?.currency || "USD") as string;

  return (
    <div className="w-full space-y-6 p-6">
      <PageHeader
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        icon={Receipt}
        actions={
          <IconActionButton
            label="Add Expense"
            onClick={openCreate}
            variant="default"
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {monthlyTotalsQuery.isLoading ? "..." : `${(currentMonthTotal?.totalAmount ?? 0).toFixed(2)} ${currency}`}
            </div>
            <p className="text-xs text-muted-foreground">{currentMonthKey}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend (Selected Range)</CardTitle>
            <Receipt className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {monthlyTotalsQuery.isLoading ? "..." : `${totalInRange.toFixed(2)} ${currency}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}`
              : "All time (as returned by API)"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <FiltersBar
            left={
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Expenses List
              </CardTitle>
            }
            right={
              <>
                <div className="w-full md:w-[320px]">
                  <SearchBar
                    currentSearchTerm={search}
                    onSearch={(term) => {
                      setSearch(term);
                      setPage(1);
                    }}
                    placeholder="Search title / notes..."
                  />
                </div>
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={(r) => {
                    setDateRange(r);
                    setPage(1);
                  }}
                />
              </>
            }
          />
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={isLoading}
            error={error}
            isEmpty={!isLoading && !error && rows.length === 0}
            onRetry={() => refetch()}
            loading={
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-[60px]" />
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-6 w-[60px]" />
                  </div>
                ))}
              </div>
            }
            errorTitle="Failed to load expenses"
            emptyTitle="No expenses found"
            emptyDescription="Try adjusting filters or add a new expense."
          >
            <>
              <TableToolbar
                label={`Expenses: ${totalItems.toLocaleString()} • Page ${page} / ${totalPages}`}
              />
              <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e: any) => (
                    <TableRow key={e.id}>
                        <TableCell className="font-mono text-sm">{e.expenseDate}</TableCell>
                        <TableCell className="font-medium">{e.title}</TableCell>
                        <TableCell>{e.category || "-"}</TableCell>
                        <TableCell className="font-semibold">
                          {Number(e.amount).toFixed(2)} {e.currency}
                        </TableCell>
                        <TableCell>
                          {e.status === "paid" ? (
                            <Badge variant="success">Paid</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-white">
                              Unpaid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {renderRowActions(e)}
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {rows.map((e: any) => (
                  <Card key={e.id} className="border-border/60 shadow-none">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{e.title}</div>
                          <div className="font-mono text-xs text-muted-foreground">{e.expenseDate}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold">
                            {Number(e.amount).toFixed(2)} {e.currency}
                          </div>
                          <div className="text-xs text-muted-foreground">{e.category || "-"}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                        {e.status === "paid" ? (
                          <Badge variant="success">Paid</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-white">Unpaid</Badge>
                        )}
                        {renderRowActions(e)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Monthly totals list */}
              <div className="mt-6">
                <div className="text-sm font-medium mb-2">Monthly totals</div>
                <div className="grid gap-2">
                  {monthlyTotalsQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading monthly totals…</div>
                  ) : monthlyTotals.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No monthly totals found.</div>
                  ) : (
                    monthlyTotals
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((m) => (
                        <div key={`${m.month}-${m.currency}`} className="flex items-center justify-between rounded-md border p-2">
                          <div className="font-mono text-sm">{m.month}</div>
                          <div className="font-semibold">{m.totalAmount.toFixed(2)} {m.currency}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <TablePager
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={limit}
                pageSizeOptions={[10, 20, 50, 100, 200]}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setLimit(n);
                  setPage(1);
                }}
                isDisabled={isLoading}
                noun="expenses"
              />
            </>
          </QueryState>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId == null ? "Add Expense" : `Edit Expense #${editingId}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expense-title" className="text-right">Title</Label>
              <Input
                id="expense-title"
                className="col-span-3"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expense-category" className="text-right">Category</Label>
              <Input
                id="expense-category"
                className="col-span-3"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expense-amount" className="text-right">Amount</Label>
              <Input
                id="expense-amount"
                className="col-span-2"
                type="number"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              />
              <Input
                className="col-span-1"
                aria-label="Currency"
                value={draft.currency}
                onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expense-date" className="text-right">Date</Label>
              <Input
                id="expense-date"
                className="col-span-3"
                type="date"
                value={draft.expenseDate}
                onChange={(e) => setDraft((d) => ({ ...d, expenseDate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label id="expense-status-label" className="text-right">Status</Label>
              <div className="col-span-3 flex gap-2" role="group" aria-labelledby="expense-status-label">
                <Button
                  type="button"
                  variant={draft.status === "unpaid" ? "default" : "outline"}
                  onClick={() => setDraft((d) => ({ ...d, status: "unpaid" }))}
                >
                  Unpaid
                </Button>
                <Button
                  type="button"
                  variant={draft.status === "paid" ? "default" : "outline"}
                  onClick={() => setDraft((d) => ({ ...d, status: "paid" }))}
                >
                  Paid
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="expense-notes" className="text-right mt-2">Notes</Label>
              <textarea
                id="expense-notes"
                className="col-span-3 min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              {MESSAGES.validation.confirmDeleteExpense}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeDelete}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


