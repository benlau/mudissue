import { SearchQueryParser } from "../../../src/utils/search/SearchQueryParser.ts";

describe("SearchQueryParser", () => {
  test("parses text, phrase, and negation terms", () => {
    const parser = new SearchQueryParser();
    const terms = parser.parse('hello "promo code" -spam');

    expect(terms).toEqual([
      { type: "text", value: "hello", negated: false },
      { type: "phrase", value: "promo code", negated: false },
      { type: "text", value: "spam", negated: true },
    ]);
  });

  test("parses tag: as tag type", () => {
    const parser = new SearchQueryParser();
    const tagTerms = parser.parse("tag:bug");

    expect(tagTerms).toEqual([
      { type: "tag", value: "bug", negated: false },
    ]);
  });

  test("parses operator terms with parsed dates", () => {
    const parser = new SearchQueryParser();
    const terms = parser.parse("tag:important after:-7d");

    const tagTerm = terms.find((term) => term.type === "tag");
    const afterTerm = terms.find((term) => term.type === "after");

    expect(tagTerm).toEqual(
      expect.objectContaining({
        type: "tag",
        value: "important",
        negated: false,
      }),
    );
    expect(afterTerm).toEqual(
      expect.objectContaining({
        type: "after",
        value: "-7d",
        negated: false,
      }),
    );
    expect(afterTerm?.date).toBeInstanceOf(Date);
  });

  test("parses OR lists for a single operator", () => {
    const parser = new SearchQueryParser();
    const terms = parser.parse("tag:important,open");

    expect(terms).toEqual(
      [
        {
          type: "or",
          value: "OR",
          negated: false,
          terms: [
            {
              type: "tag",
              value: "important",
              negated: false,
            },
            {
              type: "tag",
              value: "open",
              negated: false,
            }
          ]
        }
      ]
    );
  });

  test("parses OR lists with repeated operator tokens", () => {
    const parser = new SearchQueryParser();
    const terms = parser.parse("tag:important,tag:open");

    expect(terms).toEqual(
      [
        {
          type: "or",
          value: "OR",
          negated: false,
          terms: [
            {
              type: "tag",
              value: "important",
              negated: false,
            },
            {
              type: "tag",
              value: "tag:open",
              negated: false,
            }
          ]
        }
      ]
    );
  });
});
