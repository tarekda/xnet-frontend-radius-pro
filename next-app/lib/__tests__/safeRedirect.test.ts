import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safeRedirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths including query strings", () => {
    expect(safeRedirectPath("/users/list")).toBe("/users/list");
    expect(safeRedirectPath("/alerts?id=1")).toBe("/alerts?id=1");
  });

  it("rejects protocol-relative and off-site targets", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
  });

  it("does not bounce back to login", () => {
    expect(safeRedirectPath("/login")).toBe("/");
    expect(safeRedirectPath("/login?from=/users")).toBe("/");
  });

  it("decodes a stored from= value", () => {
    expect(safeRedirectPath("%2Fonline-users")).toBe("/online-users");
  });
});
