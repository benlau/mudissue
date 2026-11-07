import {
  DEFAULT_STATUS_LIST,
  StatusAliasesAccessor,
  StatusListAccessor,
  SystemStatus,
} from "../../src/types/status.ts";

describe("StatusListAccessor", () => {
  describe("parse", () => {
    it("parses a comma-separated string", () => {
      const list = StatusListAccessor.parse("open, backlog, planned").get();
      expect(list).toEqual(["open", "backlog", "planned"]);
    });

    it("parses a YAML array", () => {
      const list = StatusListAccessor.parse(["open", "backlog"]).get();
      expect(list).toEqual(["open", "backlog"]);
    });

    it("rejects duplicate status names", () => {
      expect(() => StatusListAccessor.parse(["open", "open"]).get()).toThrow(
        /Duplicate status name/,
      );
    });

    it("rejects an empty list", () => {
      expect(() => StatusListAccessor.parse([]).get()).toThrow();
    });
  });

  describe("getDefaultStatus", () => {
    it("returns the first item in the list", () => {
      expect(
        StatusListAccessor.parse("pending, open, closed").getDefaultStatus(),
      ).toBe("pending");
    });
  });
});

describe("StatusAliasesAccessor", () => {
  describe("parse", () => {
    it("parses alias entries with comma-separated statuses", () => {
      const aliases = StatusAliasesAccessor.parse({
        [SystemStatus.Resolved]: { statuses: "done, wontfix" },
        active: { statuses: ["open", "in_progress"] },
      }).get();

      expect(aliases).toEqual({
        [SystemStatus.Resolved]: ["done", "wontfix"],
        active: ["open", "in_progress"],
      });
    });

    it("rejects duplicate alias names that differ only by case", () => {
      expect(() =>
        StatusAliasesAccessor.parse({
          resolved: { statuses: ["done"] },
          Resolved: { statuses: ["closed"] },
        }),
      ).toThrow(/Duplicate status alias name/);
    });

    it("rejects an alias with an empty status list", () => {
      expect(() =>
        StatusAliasesAccessor.parse({
          active: { statuses: [] },
        }),
      ).toThrow();
    });
  });

  describe("withAliasIfAbsent", () => {
    it("adds an alias only when that name is not already present", () => {
      const aliases = StatusAliasesAccessor.parse({
        [SystemStatus.Resolved]: { statuses: ["done"] },
      })
        .withAliasIfAbsent(SystemStatus.Resolved, ["closed"])
        .withAliasIfAbsent("active", ["open"])
        .get();

      expect(aliases).toEqual({
        [SystemStatus.Resolved]: ["done"],
        active: ["open"],
      });
    });
  });
});

describe("defaults", () => {
  it("parses built-in status list", () => {
    expect(StatusListAccessor.parse(DEFAULT_STATUS_LIST).get()).toEqual(
      DEFAULT_STATUS_LIST,
    );
  });
});
