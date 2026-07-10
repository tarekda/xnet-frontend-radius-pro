import { describe, expect, it } from "vitest";
import type { Header } from "@tanstack/react-table";
import { ariaSortFor } from "../tableA11y";

function mockHeader(opts: {
  canSort?: boolean;
  sorted?: false | "asc" | "desc";
}): Header<unknown, unknown> {
  return {
    column: {
      getCanSort: () => opts.canSort ?? true,
      getIsSorted: () => opts.sorted ?? false,
    },
  } as Header<unknown, unknown>;
}

describe("ariaSortFor", () => {
  it("returns undefined for non-sortable columns", () => {
    expect(ariaSortFor(mockHeader({ canSort: false }))).toBeUndefined();
  });

  it("returns none when sortable but unsorted", () => {
    expect(ariaSortFor(mockHeader({ sorted: false }))).toBe("none");
  });

  it("returns ascending for asc sort", () => {
    expect(ariaSortFor(mockHeader({ sorted: "asc" }))).toBe("ascending");
  });

  it("returns descending for desc sort", () => {
    expect(ariaSortFor(mockHeader({ sorted: "desc" }))).toBe("descending");
  });
});
