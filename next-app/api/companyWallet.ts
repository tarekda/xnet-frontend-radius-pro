import { apiClient } from "@/api/client";

export type CompanyWalletEntryDto = {
  id: string;
  amount: string;
  currency: string;
  entryType: "credit" | "debit";
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CompanyWalletLedger = {
  data: CompanyWalletEntryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  balance: number;
};

export async function fetchCompanyWallet(params?: {
  entryType?: "credit" | "debit";
  page?: number;
  limit?: number;
}): Promise<CompanyWalletLedger> {
  const { data } = await apiClient.get("/admin/company-wallet", { params });
  return (data?.data ?? data) as CompanyWalletLedger;
}

export async function creditCompanyWallet(input: { amount: number; note?: string }) {
  const { data } = await apiClient.post("/admin/company-wallet/credit", input);
  return data?.data as { entry: CompanyWalletEntryDto; balance: number };
}

export async function debitCompanyWallet(input: { amount: number; note?: string }) {
  const { data } = await apiClient.post("/admin/company-wallet/debit", input);
  return data?.data as { entry: CompanyWalletEntryDto; balance: number };
}

export async function fetchCompanyWalletBalance(): Promise<number> {
  const { data } = await apiClient.get("/admin/company-wallet/balance");
  return Number((data?.data ?? data)?.balance ?? 0);
}
