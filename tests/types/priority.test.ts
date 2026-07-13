import {
  DEFAULT_PRIORITY_LIST,
  DEFAULT_PRIORITY_TABLE,
  PriorityTableAccessor,
} from "../../src/types/priority.ts";

describe("PriorityTableAccessor", () => {
  describe("parse", () => {
    it("parses a comma-separated string", () => {
      const table = PriorityTableAccessor.parse(
        "urgent, high, medium, low",
      ).get();
      expect(table).toEqual({
        initialPriority: "urgent",
        priorities: ["urgent", "high", "medium", "low"],
      });
    });

    it("parses a YAML array", () => {
      const table = PriorityTableAccessor.parse(["urgent", "high"]).get();
      expect(table).toEqual({
        initialPriority: "urgent",
        priorities: ["urgent", "high"],
      });
    });

    it("strips the default marker from list names", () => {
      const table = PriorityTableAccessor.parse(
        "urgent, high, *medium, low",
      ).get();
      expect(table).toEqual({
        initialPriority: "medium",
        priorities: ["urgent", "high", "medium", "low"],
      });
    });

    it("uses the first item as initial priority when no marker is present", () => {
      expect(
        PriorityTableAccessor.parse("urgent, high, medium, low").get()
          .initialPriority,
      ).toBe("urgent");
    });

    it("rejects duplicate priority names", () => {
      expect(() =>
        PriorityTableAccessor.parse(["urgent", "urgent"]).get(),
      ).toThrow(/Duplicate priority name/);
    });

    it("rejects more than one default marker", () => {
      expect(() =>
        PriorityTableAccessor.parse(["*urgent", "*high"]).get(),
      ).toThrow(/At most one default priority marker/);
    });

    it("rejects an empty list", () => {
      expect(() => PriorityTableAccessor.parse([]).get()).toThrow();
    });

    it("rejects an empty name after the default marker", () => {
      expect(() => PriorityTableAccessor.parse(["*"]).get()).toThrow();
    });
  });
});

describe("defaults", () => {
  it("parses built-in priority config with default marker", () => {
    expect(
      PriorityTableAccessor.parse(["urgent", "high", "*medium", "low"]).get(),
    ).toEqual(DEFAULT_PRIORITY_TABLE);
  });
});
