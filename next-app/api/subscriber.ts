import axios from "axios";
import { apiClient } from "./client";

export type SubscriberMe = {
  username: string;
  fullName?: string | null;
  walletBalance?: number;
  isExpired?: boolean;
  accountStatus?: string | null;
  expiresAt?: string | null;
  profileName?: string | null;
  planName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SubscriberUsage = {
  usedBytes?: number;
  quotaBytes?: number;
  used?: number;
  quota?: number;
  dailyUsed?: number;
  dailyQuota?: number;
  monthlyUsed?: number;
  monthlyQuota?: number;
  isFallback?: boolean;
};

export type SubscriberInvoice = {
  id: number;
  status?: string;
  billingMonth?: string;
  amount?: number;
  totalAmount?: number;
  remainingDue?: number;
  amountPaidToward?: number;
  payDueDate?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  debitLabel?: string | null;
};

export type PaymentProviderInfo = {
  provider: "stub" | "whish" | string;
  whishConfigured: boolean;
  currency: string;
  qrEnabled?: boolean;
  qrImageUrl?: string | null;
  qrLabel?: string;
  qrHint?: string;
  qrDeepLink?: string | null;
};

export type SubscriberSession = {
  radacctid?: number | string;
  acctsessionid?: string;
  acctstarttime?: string;
  acctstoptime?: string | null;
  framedipaddress?: string | null;
  framedIPAddress?: string | null;
  callingstationid?: string | null;
  acctsessiontime?: number;
  acctinputoctets?: number;
  acctoutputoctets?: number;
};

export type WalletLedgerEntry = {
  id?: number;
  amount: number;
  currency?: string;
  entryType?: string;
  createdAt?: string;
  note?: string | null;
  reference?: string | null;
};

export type VoucherPlan = {
  id: number;
  profileName: string;
  price: number;
  durationDays: number;
  monthlyQuotaGB?: number | null;
  speedDownMbps?: number | null;
  speedUpMbps?: number | null;
};

export type PaymentClaim = {
  id: number;
  status: "pending" | "confirmed" | "rejected";
  whishReference: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  reviewedAt?: string | null;
};

export async function subscriberLogin(username: string, password: string) {
  const { data } = await apiClient.post("/auth/subscriber/login", { username, password });
  return data;
}

export async function subscriberRefresh() {
  const { data } = await apiClient.post("/auth/subscriber/refresh", {});
  return data;
}

export async function subscriberLogout() {
  await apiClient.post("/auth/subscriber/logout", {});
}

export async function fetchSubscriberMe(): Promise<SubscriberMe> {
  const { data } = await apiClient.get("/subscriber/me");
  return data.data as SubscriberMe;
}

export async function fetchSubscriberUsage(): Promise<SubscriberUsage> {
  const { data } = await apiClient.get("/subscriber/usage");
  return data.data as SubscriberUsage;
}

export async function fetchSubscriberInvoices(): Promise<SubscriberInvoice[]> {
  const { data } = await apiClient.get("/subscriber/invoices");
  return (data.data || []) as SubscriberInvoice[];
}

export async function fetchSubscriberSessions(limit = 5): Promise<SubscriberSession[]> {
  const { data } = await apiClient.get("/subscriber/sessions", { params: { limit } });
  return (data.data?.sessions || []) as SubscriberSession[];
}

export async function fetchSubscriberPaymentProvider(): Promise<PaymentProviderInfo | null> {
  const { data } = await apiClient.get("/subscriber/payment-provider");
  return (data.data || null) as PaymentProviderInfo | null;
}

export async function fetchSubscriberWalletLedger(limit = 20): Promise<WalletLedgerEntry[]> {
  const { data } = await apiClient.get("/subscriber/wallet/ledger", { params: { limit } });
  return (data.data || []) as WalletLedgerEntry[];
}

export async function fetchSubscriberInvoiceClaims(invoiceId: number): Promise<PaymentClaim[]> {
  const { data } = await apiClient.get(`/subscriber/invoices/${invoiceId}/payment-claims`);
  return (data.data || []) as PaymentClaim[];
}

export async function fetchVoucherPlans(): Promise<VoucherPlan[]> {
  const { data } = await apiClient.get("/subscriber/voucher-plans");
  return (data.data || []) as VoucherPlan[];
}

export async function buyVoucher(profileId: number) {
  const { data } = await apiClient.post("/subscriber/buy-voucher", { profileId });
  return data;
}

export async function redeemVoucher(pinCode: string) {
  const { data } = await apiClient.post("/subscriber/redeem-voucher", { pinCode });
  return data;
}

export async function createSubscriberPaymentIntent(invoiceId: number) {
  const { data } = await apiClient.post(`/subscriber/invoices/${invoiceId}/payment-intent`, {}, { timeout: 40_000 });
  return data;
}

export async function paySubscriberInvoiceFromWallet(invoiceId: number) {
  const { data } = await apiClient.post(`/subscriber/invoices/${invoiceId}/pay-from-wallet`, {});
  return data;
}

export async function reportSubscriberWhishPayment(
  invoiceId: number,
  body: { whishReference: string; amount: number; currency: string; note?: string }
) {
  const { data } = await apiClient.post(`/subscriber/invoices/${invoiceId}/report-whish-payment`, body);
  return data;
}

/** Probe cookie session; refresh once on 401. */
export async function restoreSubscriberSession(): Promise<boolean> {
  try {
    await fetchSubscriberMe();
    return true;
  } catch (err) {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) return false;
    try {
      await subscriberRefresh();
      await fetchSubscriberMe();
      return true;
    } catch {
      return false;
    }
  }
}
