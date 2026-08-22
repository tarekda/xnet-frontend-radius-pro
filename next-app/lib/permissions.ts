import type { AuthUser } from "@/types/api";

export function getPermissions(user: AuthUser | null | undefined): string[] {
  return Array.isArray(user?.permissions) ? user!.permissions! : [];
}

export function can(user: AuthUser | null | undefined, permission: string): boolean {
  return getPermissions(user).includes(permission);
}

export function canAny(user: AuthUser | null | undefined, permissions: string[]): boolean {
  if (permissions.length === 0) return true;
  const p = getPermissions(user);
  return permissions.some((perm) => p.includes(perm));
}

export function canAll(user: AuthUser | null | undefined, permissions: string[]): boolean {
  const p = getPermissions(user);
  return permissions.every((perm) => p.includes(perm));
}

/** Anyone who can see billing / pay invoices can open the operator treasury. */
export const COMPANY_WALLET_VIEW_PERMS = [
  "billing.companyWallet.view",
  "ui.sidebar.admin.companyWallet.show",
  "admin.resellers.manage",
  "admin.access.manage",
  "billing.externalInvoices.pay",
  "billing.externalInvoices.view",
] as const;

export const COMPANY_WALLET_MANAGE_PERMS = [
  "billing.companyWallet.manage",
  "admin.resellers.fund",
  "admin.access.manage",
  "billing.externalInvoices.pay",
] as const;

