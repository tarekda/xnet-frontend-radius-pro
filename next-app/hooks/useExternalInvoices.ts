import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ExternalInvoice } from '@/types/api';
import { notify } from '@/lib/notify';
import { MESSAGES } from '@/constants/messages';
import { isFeatureEnabled } from "@/lib/featureFlags";
import { sharePaidExternalInvoice } from "@/api/invoices";
// Removed unused local table states (sorting/rowSelection) from this hook

// interface ExternalInvoice {
//     id: number;
//     username: string;
//     fullName: string;
//     email: string;
//     phoneNumber: string;
//     address: string;
//     billingMonth: string;
//     amount: number;
//     status: string;
//     createdAt: string;
//     paidAt: string | null;
// }

interface PaginatedResponse<T> {
    data: T[];
    page: number;
    totalPages: number;
    total: number;
    metrics: InvoiceMetrics;
}

export interface InvoiceMetrics {
    totalInvoices: number;
    totalPaid: number;
    totalUnpaid: number;
    totalAmount: number;
    totalPending: number;
}


interface ApiResponse<T> {
    status: string;
    message: string;
    data: T;
}

const fetchExternalInvoices = async (
    page: number,
    limit: number,
    searchQuery: string,
    from?: string,
    to?: string,
    status?: string,
    ageBucket?: string,
    graceDays?: number,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
    missing?: string,
    payDue?: string
): Promise<ApiResponse<PaginatedResponse<ExternalInvoice>>> => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (searchQuery) params.set('search', searchQuery);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (status && status !== 'all') params.set('status', status);
    if (ageBucket && ageBucket !== 'all') params.set('ageBucket', ageBucket);
    if (typeof graceDays === 'number' && Number.isFinite(graceDays)) params.set('graceDays', String(Math.max(0, Math.round(graceDays))));
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);
    if (missing && missing !== 'all') params.set('missing', missing);
    if (payDue && payDue !== 'all') params.set('payDue', payDue);
    const response = await apiClient.get(`/invoices/external?${params.toString()}`);
    return response.data;
};

const setInvoiceAsPaid = async (
    invoiceId: number,
    paymentMethod: "cash" | "pos" | "transfer" | "other" | "gateway" | "wallet" = "cash",
    extras?: {
      paymentReference?: string;
      paymentProvider?: string;
      paidAmount?: number;
      debitRemainder?: boolean;
    }
): Promise<ApiResponse<ExternalInvoice>> => {
    const response = await apiClient.post(`/invoices/external/pay/${invoiceId}`, {
      paymentMethod,
      paymentReference: extras?.paymentReference,
      paymentProvider: extras?.paymentProvider,
      paidAmount: extras?.paidAmount,
      debitRemainder: extras?.debitRemainder || undefined,
    });
    return response.data;
};

const unpayInvoice = async (invoiceId: number): Promise<ApiResponse<ExternalInvoice>> => {
    const response = await apiClient.post(`/invoices/external/unpay/${invoiceId}`);
    return response.data;
};

const updateInvoice = async (invoiceId: number, invoiceData: Partial<ExternalInvoice>): Promise<ApiResponse<ExternalInvoice>> => {
    const response = await apiClient.put(`/invoices/external/${invoiceId}`, invoiceData);
    return response.data;
};


const deleteInvoice = async (invoiceId: number): Promise<ApiResponse<ExternalInvoice>> => {
    const response = await apiClient.delete(`/invoices/external/${invoiceId}`);
    return response.data;
};

type BulkDeleteResult = {
    deletedIds: number[];
    failed: Array<{ id: number; reason: string }>;
};

const deleteInvoicesBulk = async (invoiceIds: number[]): Promise<BulkDeleteResult> => {
    const uniqueIds = Array.from(new Set(invoiceIds)).filter((x) => Number.isFinite(x) && x > 0);
    if (uniqueIds.length === 0) return { deletedIds: [], failed: [] };

    // Prefer backend bulk endpoint (soft-delete); fallback to per-id deletes if unavailable
    try {
        const response = await apiClient.post(`/invoices/external/bulk-delete`, { invoiceIds: uniqueIds });
        const payload = response?.data?.data ?? response?.data; // backend uses { success, message, data }
        const deletedIds = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
        const failed = Array.isArray(payload?.failed) ? payload.failed : [];
        return { deletedIds, failed };
    } catch {
        const results = await Promise.allSettled(
            uniqueIds.map(async (id) => {
                await deleteInvoice(id);
                return id;
            })
        );

        const deletedIds: number[] = [];
        const failed: Array<{ id: number; reason: string }> = [];

        results.forEach((r, idx) => {
            const id = uniqueIds[idx];
            if (r.status === 'fulfilled') {
                deletedIds.push(id);
            } else {
                failed.push({ id, reason: (r as any).reason?.message || String((r as any).reason || 'Unknown error') });
            }
        });

        return { deletedIds, failed };
    }
};

const sendReminder = async (invoiceId: number): Promise<ApiResponse<{ ok: boolean; paymentLinkError?: string | null }>> => {
    if (!isFeatureEnabled("whatsapp-remind")) {
        throw new Error("Reminder feature is disabled");
    }
    const response = await apiClient.post(`/invoices/external/${invoiceId}/remind`, {}, { timeout: 40_000 });
    return response.data;
};

type EmailInvoiceVariables = {
    invoiceId: number;
    /** Optional override; defaults to the subscriber's email on file. */
    to?: string;
    note?: string;
    /** Absolute link to the printable invoice, included in the email body. */
    printUrl?: string;
};

const emailInvoice = async (
    variables: EmailInvoiceVariables
): Promise<ApiResponse<{ ok: boolean; to: string[]; subject: string }>> => {
    const response = await apiClient.post(`/invoices/external/${variables.invoiceId}/email`, {
        to: variables.to || undefined,
        note: variables.note || undefined,
        printUrl: variables.printUrl || undefined,
    });
    return response.data;
};

type UpdateInvoiceVariables = {
    invoiceId: number;
    invoiceData: Partial<ExternalInvoice>;
};
type BulkUpdateResult = {
    updatedIds: number[];
    failed: Array<{ id: number; reason: string }>;
};

const bulkUpdateInvoices = async (
    invoiceIds: number[],
    updateData: { payDueDate?: string | null; address?: string | null }
): Promise<BulkUpdateResult> => {
    const response = await apiClient.post(`/invoices/external/bulk-update`, { invoiceIds, ...updateData });
    const payload = response?.data?.data ?? response?.data;
    return {
        updatedIds: Array.isArray(payload?.updatedIds) ? payload.updatedIds : [],
        failed: Array.isArray(payload?.failed) ? payload.failed : [],
    };
};

type Props = {
    search: string;
    initialPage: number;
    pageSize: number;
    from?: string;
    to?: string;
    status?: string;
    ageBucket?: string;
    graceDays?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    missing?: string;
    payDue?: string;
    /** Set to false to skip the list query and use only the mutations. */
    enabled?: boolean;
};

export const useExternalInvoices = ({ initialPage, pageSize, search, from, to, status, ageBucket, graceDays, sortBy, sortDir, missing, payDue, enabled = true }: Props) => {
    const [currentPage, setCurrentPage] = useState(initialPage);
    const queryClient = useQueryClient();

    const { data, error, isLoading, refetch } = useQuery<ApiResponse<PaginatedResponse<ExternalInvoice>>, Error>({
        queryKey: ['externalInvoices', currentPage, pageSize, search, from, to, status, ageBucket, graceDays, sortBy, sortDir, missing, payDue],
        queryFn: () => fetchExternalInvoices(currentPage, pageSize, search, from, to, status, ageBucket, graceDays, sortBy, sortDir, missing, payDue),
        enabled,
        // Keep the previous page visible while the next one loads (no loading flash on paging),
        // and avoid redundant refetches for filters that were just fetched.
        placeholderData: keepPreviousData,
        staleTime: 15_000,
    });

    const updateInvoiceMutation = useMutation<ApiResponse<ExternalInvoice>, Error, UpdateInvoiceVariables>({
        mutationFn: ({ invoiceId, invoiceData }) => updateInvoice(invoiceId, invoiceData),
        onSuccess: () => {
            notify.success("Saved", MESSAGES.invoices.external.updated);
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
            refetch();
        },
        onError: (error) => {
            notify.error("Save failed", error instanceof Error ? error.message : MESSAGES.common.updateFailed);
        }

    });


    const deleteInvoiceMutation = useMutation({
        mutationFn: (invoiceId: number) => deleteInvoice(invoiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
        }
    });

    const bulkDeleteInvoicesMutation = useMutation<BulkDeleteResult, Error, number[]>({
        mutationFn: (invoiceIds: number[]) => deleteInvoicesBulk(invoiceIds),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
            if (result.deletedIds.length > 0) {
                notify.success("Deleted", `Deleted ${result.deletedIds.length} invoice(s).`);
            }
            if (result.failed.length > 0) {
                notify.error("Delete failed", `Failed to delete ${result.failed.length} invoice(s).`);
            }
        },
        onError: (error: Error) => {
            notify.error("Delete failed", error.message);
        }
    });

    const setInvoiceAsPaidMutation = useMutation({
        mutationFn: (vars: {
            invoiceId: number;
            paymentMethod?: "cash" | "pos" | "transfer" | "other" | "gateway" | "wallet";
            paymentReference?: string;
            paymentProvider?: string;
            paidAmount?: number;
            debitRemainder?: boolean;
            silent?: boolean;
        }) =>
            setInvoiceAsPaid(vars.invoiceId, vars.paymentMethod ?? "cash", {
              paymentReference: vars.paymentReference,
              paymentProvider: vars.paymentProvider,
              paidAmount: vars.paidAmount,
              debitRemainder: vars.debitRemainder,
            }),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
            if (!vars?.silent) notify.success("Success", MESSAGES.invoices.external.paid);
        },
        onError: (error: Error) => {
            notify.error("Action failed", error.message);
        },
    });

    const unpayInvoiceMutation = useMutation({
        mutationFn: (vars: { invoiceId: number; silent?: boolean }) => unpayInvoice(vars.invoiceId),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
            if (!vars?.silent) notify.success("Success", MESSAGES.invoices.external.unpaid);
        },
        onError: (error: Error) => {
            notify.error("Action failed", error.message);
        },
    });

    const sendReminderMutation = useMutation({
        mutationFn: sendReminder,
        onSuccess: (response) => {
            const paymentLinkError = response?.data?.paymentLinkError;
            if (paymentLinkError) {
                notify.error("Reminder sent without payment link", paymentLinkError);
                return;
            }
            notify.success("Sent", response?.message || MESSAGES.invoices.external.reminderSent);
        },
        onError: (error: unknown) => {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                (error instanceof Error ? error.message : "Failed to send reminder");
            notify.error("Send failed", message);
        },
    });

    const emailInvoiceMutation = useMutation<
        ApiResponse<{ ok: boolean; to: string[]; subject: string }>,
        Error,
        EmailInvoiceVariables
    >({
        mutationFn: emailInvoice,
        onSuccess: (response) => {
            const recipients = response?.data?.to?.join(", ") || "the subscriber";
            notify.success("Invoice emailed", `Sent to ${recipients}.`);
        },
        onError: (error: unknown) => {
            const message =
                (error as any)?.response?.data?.message ||
                (error instanceof Error ? error.message : "Could not send the invoice email.");
            notify.error("Email failed", message);
        },
    });

    const sharePaidInvoiceMutation = useMutation({
        mutationFn: async (invoiceId: number) => {
            if (!isFeatureEnabled("whatsapp-remind")) {
                throw new Error("WhatsApp messaging is disabled");
            }
            await sharePaidExternalInvoice(invoiceId);
        },
        onSuccess: () => {
            notify.success("Shared", "Paid invoice confirmation sent on WhatsApp.");
        },
        onError: (error: Error) => {
            notify.error("Share failed", error.message);
        },
    });

    const bulkUpdateInvoicesMutation = useMutation<
        BulkUpdateResult,
        Error,
        { invoiceIds: number[]; payDueDate?: string | null; address?: string | null }
    >({
        mutationFn: ({ invoiceIds, payDueDate, address }) => bulkUpdateInvoices(invoiceIds, { payDueDate, address }),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['externalInvoicesPaymentDue'] });
            queryClient.invalidateQueries({ queryKey: ['dunningPreview'] });
            if (result.updatedIds.length > 0) {
                notify.success("Updated", `Updated ${result.updatedIds.length} invoice(s).`);
            }
            if (result.failed.length > 0) {
                notify.error("Partial update", `Failed to update ${result.failed.length} invoice(s).`);
            }
        },
        onError: (error: Error) => {
            notify.error("Update failed", error.message);
        },
    });

    return {
        data,
        error,
        isLoading,
        refetch,
        setCurrentPage,
        currentPage,
        setInvoiceAsPaidMutation,
        unpayInvoiceMutation,
        updateInvoiceMutation,
        deleteInvoiceMutation,
        bulkDeleteInvoicesMutation,
        sendReminderMutation,
        emailInvoiceMutation,
        sharePaidInvoiceMutation,
        bulkUpdateInvoicesMutation,
    };
};