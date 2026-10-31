import { apiClient } from "@/api/client";

export type ExternalUserProvider = "myisp" | "myisp2" | "idm" | "terra" | "terra2" | "misp";

export interface ExternalUser {
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  plan: string | null;
  expiryDate: string | null;
  macAddress: string | null;
  accountStatus?: "active" | "inactive" | "expired";
  provider: ExternalUserProvider;
  providerLabel: string;
  online: boolean;
  sessionIp: string | null;
  sessionStarted: string | null;
}

export interface ProviderResult {
  provider: ExternalUserProvider;
  label: string;
  users: ExternalUser[];
  error: string | null;
  fetchedAt: string;
}

export interface ExternalUsersResponse {
  providers: ProviderResult[];
  totalUsers: number;
  totalOnline: number;
  fetchedAt: string;
}

export type ExternalUserCommandName = "renew" | "activate" | "deactivate";

export interface ExternalUserCommand {
  command: ExternalUserCommandName;
  upstream: string;
  description: string;
  localSession: "disconnect" | "none";
  wired: boolean;
}

export interface ProviderMeta {
  key: ExternalUserProvider;
  label: string;
  configured: boolean;
  commands?: ExternalUserCommand[];
}

export async function fetchExternalUsers(params?: {
  providers?: ExternalUserProvider[];
  search?: string;
  online?: boolean | null;
}): Promise<ExternalUsersResponse> {
  const query: Record<string, string> = {};
  if (params?.providers?.length) {
    query.providers = params.providers.join(",");
  }
  if (params?.search?.trim()) {
    query.search = params.search.trim();
  }
  if (params?.online !== null && params?.online !== undefined) {
    query.online = String(params.online);
  }
  const resp = await apiClient.get("/external-users", { params: query });
  return resp.data?.data as ExternalUsersResponse;
}

export async function fetchExternalUserProviders(): Promise<ProviderMeta[]> {
  const resp = await apiClient.get("/external-users/providers");
  return (resp.data?.data ?? []) as ProviderMeta[];
}

export async function runExternalUserCommand(
  provider: ExternalUserProvider,
  username: string,
  command: ExternalUserCommandName,
  months = 1
): Promise<void> {
  await apiClient.post(
    `/external-users/${encodeURIComponent(provider)}/${encodeURIComponent(username)}/commands`,
    { command, months }
  );
}
