import i18n from "@/i18n/config";

function activeLocale(): string {
  const lng = i18n.language || "en";
  if (lng.startsWith("ar")) return "ar-LB";
  if (lng.startsWith("es")) return "es";
  return "en-US";
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "USD"
): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  const code = currency === "LBP" ? "LBP" : currency || "USD";
  try {
    return new Intl.NumberFormat(activeLocale(), {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "LBP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${code}`;
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleString(activeLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMonth(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(activeLocale(), { year: "numeric", month: "long" });
}

export function formatBytes(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x < 10 && i > 0 ? x.toFixed(1) : Math.round(x)} ${units[i]}`;
}
