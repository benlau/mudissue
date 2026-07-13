import {
  DEFAULT_STATUS_LIST,
  StatusListAccessor,
} from "../../src/types/status.ts";

describe("StatusListAccessor", () => {
  describe("parse", () => {
    it("parses a comma-separated string", () => {
      const list = StatusListAccessor.parse(
        "open, backlog, planned",
      ).get();
      expect(list).toEqual(["open", "backlog", "planned"]);
    });

    it("parses a YAML array", () => {
      const list = StatusListAccessor.parse(["open", "backlog"]).get();
      expect(list).toEqual(["open", "backlog"]);
    });

    it("rejects duplicate status names", () => {
      expect(() =>
        StatusListAccessor.parse(["open", "open"]).get(),
      ).toThrow(/Duplicate status name/);
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

describe("defaults", () => {
  it("parses built-in status list", () => {
    expect(StatusListAccessor.parse(DEFAULT_STATUS_LIST).get()).toEqual(
      DEFAULT_STATUS_LIST,
    );
  });
});
