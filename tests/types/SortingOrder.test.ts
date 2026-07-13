import {
  DEFAULT_SORTING_ORDER,
  SortingOrderAccessor,
  SortingOrderListAccessor,
  SortingOrderSchema,
} from "../../src/types/SortingOrder.ts";

describe("SortingOrderSchema", () => {
  it("accepts valid sort order", () => {
    const parsed = SortingOrderSchema.safeParse({
      field: "title",
      order: "asc",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts created_at field", () => {
    const parsed = SortingOrderSchema.safeParse({
      field: "created_at",
      order: "desc",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown field", () => {
    const parsed = SortingOrderSchema.safeParse({
      field: "unknown",
      order: "asc",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("SortingOrderAccessor.parseJson", () => {
  it("returns default when value is missing", () => {
    expect(SortingOrderAccessor.parseJson(undefined).get()).toEqual(
      DEFAULT_SORTING_ORDER,
    );
  });

  it("parses valid JSON from registry", () => {
    const value = JSON.stringify({ field: "id", order: "asc" });
    expect(SortingOrderAccessor.parseJson(value).get()).toEqual({
      field: "id",
      order: "asc",
    });
  });

  it("falls back to default on invalid JSON", () => {
    expect(SortingOrderAccessor.parseJson("not-json").get()).toEqual(
      DEFAULT_SORTING_ORDER,
    );
  });

  it("falls back to default on schema mismatch", () => {
    const value = JSON.stringify({ field: "bad", order: "up" });
    expect(SortingOrderAccessor.parseJson(value).get()).toEqual(
      DEFAULT_SORTING_ORDER,
    );
  });
});

describe("SortingOrderAccessor.parse", () => {
  it("parses ascending and descending built-in fields", () => {
    expect(SortingOrderAccessor.parse("+title")?.get()).toEqual({
      field: "title",
      order: "asc",
    });
    expect(SortingOrderAccessor.parse("-created_at")?.get()).toEqual({
      field: "created_at",
      order: "desc",
    });
  });

  it("defaults to ascending when no prefix is given", () => {
    expect(SortingOrderAccessor.parse("status")?.get()).toEqual({
      field: "status",
      order: "asc",
    });
  });

  it("passes through unknown fields as frontmatter keys", () => {
    expect(SortingOrderAccessor.parse("+assignee")?.get()).toEqual({
      field: "assignee",
      order: "asc",
    });
  });

  it("returns undefined for blank token", () => {
    expect(SortingOrderAccessor.parse("   ")).toBeUndefined();
  });

  it("returns undefined when token has direction prefix but no field", () => {
    expect(SortingOrderAccessor.parse("+")).toBeUndefined();
  });
});

describe("SortingOrderListAccessor.parse", () => {
  it("parses comma-separated tokens via SortingOrderAccessor.parse", () => {
    expect(SortingOrderListAccessor.parse("+title,-created_at").get()).toEqual([
      { field: "title", order: "asc" },
      { field: "created_at", order: "desc" },
    ]);
  });

  it("defaults to ascending when no prefix is given", () => {
    expect(SortingOrderListAccessor.parse("title,status").get()).toEqual([
      { field: "title", order: "asc" },
      { field: "status", order: "asc" },
    ]);
  });

  it("passes through unknown fields as frontmatter keys", () => {
    expect(
      SortingOrderListAccessor.parse("+assignee,-milestone").get(),
    ).toEqual([
      { field: "assignee", order: "asc" },
      { field: "milestone", order: "desc" },
    ]);
  });

  it("keeps updated_at as-is", () => {
    expect(SortingOrderListAccessor.parse("-updated_at").get()).toEqual([
      { field: "updated_at", order: "desc" },
    ]);
  });

  it("returns empty list for blank sort spec", () => {
    expect(SortingOrderListAccessor.parse("   ").get()).toEqual([]);
  });

  it("skips empty tokens", () => {
    expect(SortingOrderListAccessor.parse("title,,").get()).toEqual([
      { field: "title", order: "asc" },
    ]);
  });

  it("returns empty list when no valid tokens", () => {
    expect(SortingOrderListAccessor.parse("+").get()).toEqual([]);
  });
});
