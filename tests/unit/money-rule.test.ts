import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES, NEEDS_MONEY, effectivePermissions } from "@/lib/permissions";

describe("money only with Safe → View (owner, 28 Oct 2026)", () => {
  it("drops every money permission when the role can't view the Safe", () => {
    const p = effectivePermissions(["stock:buy", "stock:sell", "customers:view", "receipts:manage", "cash:in", "stock:input"]);
    for (const m of NEEDS_MONEY) expect(p.has(m)).toBe(false);
    expect(p.has("stock:input")).toBe(true);
  });
  it("keeps them with Safe → View", () => {
    const p = effectivePermissions(["cash:view", "stock:buy", "customers:manage"]);
    expect([...p].sort()).toEqual(["cash:view", "customers:manage", "stock:buy"]);
  });
  it("built-in roles: only Administrator and Accountant see money", () => {
    const money = DEFAULT_ROLES.filter((r) => effectivePermissions(r.permissions).has("cash:view")).map((r) => r.name).sort();
    expect(money).toEqual(["Accountant", "Administrator"]);
  });
});
