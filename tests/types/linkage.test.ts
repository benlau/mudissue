import {
  DEFAULT_LINK_TYPES,
  LinkageTypesAccessor,
} from "../../src/types/linkage.ts";

describe("LinkageTypesAccessor", () => {
  it("parses YAML list of forward/reverse pairs", () => {
    const accessor = LinkageTypesAccessor.parse([
      "parent/subissues",
      "related/related",
      "blocking/blocked_by",
    ]);

    expect(accessor.get()).toEqual([
      { forward: "parent", reverse: "subissues" },
      { forward: "related", reverse: "related" },
      { forward: "blocking", reverse: "blocked_by" },
    ]);
  });

  it("parses comma-separated string input", () => {
    const accessor = LinkageTypesAccessor.parse(
      "parent/subissues, related/related, blocking/blocked_by",
    );

    expect(accessor.get()).toEqual([
      { forward: "parent", reverse: "subissues" },
      { forward: "related", reverse: "related" },
      { forward: "blocking", reverse: "blocked_by" },
    ]);
  });

  it("looks up forward and reverse field names", () => {
    const accessor = LinkageTypesAccessor.fromDefaults();

    expect(accessor.lookupByFieldName("blocking")).toEqual({
      pair: { forward: "blocking", reverse: "blocked_by" },
      side: "forward",
    });
    expect(accessor.lookupByFieldName("blocked_by")).toEqual({
      pair: { forward: "blocking", reverse: "blocked_by" },
      side: "reverse",
    });
    expect(accessor.lookupByFieldName("unknown")).toBeUndefined();
  });

  it("returns all configured field names", () => {
    const accessor = LinkageTypesAccessor.fromDefaults();

    expect(accessor.getAllFieldNames()).toEqual([
      "parent",
      "subissues",
      "related",
      "duplicated",
      "has_duplicate",
      "blocking",
      "blocked_by",
    ]);
  });

  it("rejects invalid pair format", () => {
    expect(() => LinkageTypesAccessor.parse(["parent"])).toThrow();
    expect(() => LinkageTypesAccessor.parse(["/subissues"])).toThrow();
  });

  it("rejects duplicate field names across pairs", () => {
    expect(() =>
      LinkageTypesAccessor.parse([
        "parent/subissues",
        "parent/children",
      ]),
    ).toThrow(/Duplicate link type field name/);
  });

  it("exposes built-in defaults", () => {
    expect(DEFAULT_LINK_TYPES).toEqual([
      { forward: "parent", reverse: "subissues" },
      { forward: "related", reverse: "related" },
      { forward: "duplicated", reverse: "has_duplicate" },
      { forward: "blocking", reverse: "blocked_by" },
    ]);
  });
});
