import { apiClient } from "@/api/client";

export type ResellerDto = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  balance?: number;
};

export type ResellerLedgerEntryDto = {
  id: string;
  resellerId: number;
  amount: string;
  currency: string;
  entryType: "credit" | "debit";
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
};

export type ResellerLoginDto = {
  id: number;
  username: string;
  email: string;
  resellerId: number;
  mustChangePassword: boolean;
  /**
   * Returned only if admin didn't provide a password (one-time).
   * If admin provides a password, backend returns null here.
   */
  tempPassword: string | null;
};

export async function fetchResellers(): Promise<ResellerDto[]> {
  const { data } = await apiClient.get("/admin/resellers");
  return (data?.data ?? []) as ResellerDto[];
}

export async function createReseller(input: { name: string; code: string }): Promise<ResellerDto> {
  const { data } = await apiClient.post("/admin/resellers", input);
  return data?.data as ResellerDto;
}

export async function createResellerLogin(
  resellerId: number,
  input: { username: string; email: string; password?: string }
): Promise<ResellerLoginDto> {
  const { data } = await apiClient.post(`/admin/resellers/${resellerId}/login`, input);
  return data?.data as ResellerLoginDto;
}

export async function fundReseller(resellerId: number, input: { amount: number; note?: string; currency?: string }) {
  const { data } = await apiClient.post(`/admin/resellers/${resellerId}/fund`, input);
  return data?.data as ResellerLedgerEntryDto | { entry: ResellerLedgerEntryDto; balance: number };
}

export async function debitReseller(resellerId: number, input: { amount: number; note?: string; currency?: string }) {
  const { data } = await apiClient.post(`/admin/resellers/${resellerId}/debit`, input);
  return data?.data as { entry: ResellerLedgerEntryDto; balance: number };
}

export async function fetchResellerLedger(resellerId: number): Promise<{ balance: number; entries: ResellerLedgerEntryDto[] }> {
  const { data } = await apiClient.get(`/admin/resellers/${resellerId}/ledger`);
  return data?.data as { balance: number; entries: ResellerLedgerEntryDto[] };
}

export async function fetchResellerMe(): Promise<{ reseller: ResellerDto; balance: number }> {
  const { data } = await apiClient.get("/reseller/me");
  return data?.data as { reseller: ResellerDto; balance: number };
}

export type ResellerUserDto = {
  id: number;
  username: string;
  profileId: number;
  accountStatus: string | null;
  ownerResellerId: number | null;
  profile?: { id: number; profileName: string };
};

export async function fetchResellerUsers(): Promise<ResellerUserDto[]> {
  const { data } = await apiClient.get("/reseller/users");
  return (data?.data ?? []) as ResellerUserDto[];
}

export async function createResellerUser(input: {
  username: string;
  password: string;
  profileId: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}) {
  const { data } = await apiClient.post("/reseller/users", input);
  return data?.data as { userId: number };
}

export type ResellerCommissionDto = {
  resellerId: number;
  commissionRate: number;
  totalEarned: number;
  totalPaidOut: number;
  pendingBalance: number;
  history: ResellerLedgerEntryDto[];
};

export async function fetchResellerCommission(resellerId: number): Promise<ResellerCommissionDto> {
  const { data } = await apiClient.get(`/admin/resellers/${resellerId}/commission`);
  return data?.data as ResellerCommissionDto;
}

export async function fetchMyResellerCommission(): Promise<ResellerCommissionDto> {
  const { data } = await apiClient.get("/reseller/commission");
  return data?.data as ResellerCommissionDto;
}

export async function payoutResellerCommission(
  resellerId: number,
  input: { amount: number; note?: string }
): Promise<{ payoutId: string; amount: number; resellerId: number }> {
  const { data } = await apiClient.post(`/admin/resellers/${resellerId}/commission/payout`, input);
  return data?.data;
}

