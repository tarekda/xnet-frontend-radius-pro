import { describe, expect, it } from "vitest";
import { normalizeAlert, normalizeAlertRule, normalizeMetric } from "@/lib/alertNormalize";

describe("normalizeMetric", () => {
  it("hydrates a stored type string", () => {
    expect(normalizeMetric("users").label).toBe("Active Users");
  });

  it("passes through a catalog object", () => {
    const metric = normalizeMetric({
      type: "auth_success_rate",
      label: "Authentication Success Rate",
      unit: "%",
      description: "Percentage of successful authentication attempts",
    });
    expect(metric.type).toBe("auth_success_rate");
    expect(metric.unit).toBe("%");
  });
});

describe("normalizeAlertRule", () => {
  it("stringifies ids and parses dates", () => {
    const rule = normalizeAlertRule({
      id: 7,
      name: "High load",
      description: "",
      metric: "users",
      condition: "greater_than",
      threshold: "1000",
      duration: "5",
      severity: "high",
      enabled: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      lastTriggered: "2026-01-03T00:00:00.000Z",
      triggerCount: "2",
    });
    expect(rule.id).toBe("7");
    expect(rule.metric.type).toBe("users");
    expect(rule.createdAt).toBeInstanceOf(Date);
    expect(rule.lastTriggered).toBeInstanceOf(Date);
    expect(rule.enabled).toBe(true);
    expect(rule.triggerCount).toBe(2);
  });
});

describe("normalizeAlert", () => {
  it("parses timestamp fields used by the history tab", () => {
    const alert = normalizeAlert({
      id: 3,
      ruleId: 7,
      ruleName: "High load",
      severity: "high",
      message: "too many users",
      metric: "users",
      value: 1200,
      threshold: 1000,
      timestamp: "2026-01-03T10:00:00.000Z",
      acknowledged: true,
      acknowledgedBy: "admin",
      acknowledgedAt: "2026-01-03T10:05:00.000Z",
      resolved: true,
      resolvedAt: "2026-01-03T10:10:00.000Z",
    });
    expect(alert.id).toBe("3");
    expect(alert.timestamp).toBeInstanceOf(Date);
    expect(alert.resolvedAt).toBeInstanceOf(Date);
    expect(alert.acknowledgedBy).toBe("admin");
  });
});
