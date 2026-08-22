import { describe, expect, it } from "vitest";
import { validateStaffPassword } from "@/lib/passwordPolicy";

describe("validateStaffPassword", () => {
  it("rejects short or simple passwords", () => {
    expect(validateStaffPassword("Short1").ok).toBe(false);
    expect(validateStaffPassword("alllowercase1").ok).toBe(false);
    expect(validateStaffPassword("ALLUPPERCASE1").ok).toBe(false);
    expect(validateStaffPassword("NoDigitsHere").ok).toBe(false);
  });

  it("accepts a mixed password of 10+ characters", () => {
    expect(validateStaffPassword("GoodPass12")).toEqual({ ok: true });
  });
});
