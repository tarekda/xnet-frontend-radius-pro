import { ALERT_METRICS, type Alert, type AlertMetric, type AlertRule } from "@/types/alerts";

export function toDate(value: unknown): Date | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function toRequiredDate(value: unknown, fallback = new Date(0)): Date {
  return toDate(value) ?? fallback;
}

export function normalizeMetric(metric: unknown): AlertMetric {
  if (metric && typeof metric === "object" && "type" in (metric as object)) {
    const obj = metric as Partial<AlertMetric> & { type?: string };
    const known = ALERT_METRICS.find((m) => m.type === obj.type);
    if (known) {
      return {
        type: known.type,
        label: obj.label || known.label,
        unit: obj.unit || known.unit,
        description: obj.description || known.description,
      };
    }
    return {
      type: (obj.type as AlertMetric["type"]) || "users",
      label: obj.label || String(obj.type || "Unknown"),
      unit: obj.unit || "",
      description: obj.description || "",
    };
  }
  if (typeof metric === "string") {
    const known = ALERT_METRICS.find((m) => m.type === metric);
    if (known) return known;
  }
  return ALERT_METRICS[0];
}

export function normalizeAlertRule(raw: unknown): AlertRule {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    metric: normalizeMetric(row.metric),
    condition: (row.condition as AlertRule["condition"]) || "greater_than",
    threshold: Number(row.threshold ?? 0),
    duration: Number(row.duration ?? 0),
    severity: (row.severity as AlertRule["severity"]) || "medium",
    enabled: Boolean(row.enabled),
    createdAt: toRequiredDate(row.createdAt),
    updatedAt: toRequiredDate(row.updatedAt),
    lastTriggered: toDate(row.lastTriggered),
    triggerCount: Number(row.triggerCount ?? 0),
  };
}

export function normalizeAlert(raw: unknown): Alert {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    ruleId: String(row.ruleId ?? ""),
    ruleName: String(row.ruleName ?? ""),
    severity: (row.severity as Alert["severity"]) || "medium",
    message: String(row.message ?? ""),
    metric: typeof row.metric === "string" ? row.metric : String((row.metric as { type?: string } | undefined)?.type ?? ""),
    value: Number(row.value ?? 0),
    threshold: Number(row.threshold ?? 0),
    timestamp: toRequiredDate(row.timestamp),
    acknowledged: Boolean(row.acknowledged),
    acknowledgedBy: row.acknowledgedBy ? String(row.acknowledgedBy) : undefined,
    acknowledgedAt: toDate(row.acknowledgedAt),
    resolved: Boolean(row.resolved),
    resolvedAt: toDate(row.resolvedAt),
  };
}
