import { jest } from "@jest/globals";
import { UrlTraveler } from "../../../src/async/travelers/UrlTraveler.ts";

describe("UrlTraveler", () => {
  test("invokes callback with full URL then parent URLs until callback returns true", async () => {
    const traveler = new UrlTraveler();
    const seen: string[] = [];
    const result = await traveler.travel(
      "https://github.com/github/docs",
      async (url) => {
        seen.push(url);
        return url === "https://github.com/github";
      },
    );
    expect(result).toBe("https://github.com/github");
    expect(seen).toEqual([
      "https://github.com/github/docs",
      "https://github.com/github",
    ]);
  });

  test("returns undefined when callback never returns true", async () => {
    const traveler = new UrlTraveler();
    const seen: string[] = [];
    const result = await traveler.travel(
      "https://example.com/a/b/c",
      async (url) => {
        seen.push(url);
        return false;
      },
    );
    expect(result).toBeUndefined();
    expect(seen).toEqual([
      "https://example.com/a/b/c",
      "https://example.com/a/b",
      "https://example.com/a",
      "https://example.com",
    ]);
  });

  test("normalizes URL by stripping trailing slash", async () => {
    const traveler = new UrlTraveler();
    const seen: string[] = [];
    await traveler.travel("https://example.com/foo/", async (url) => {
      seen.push(url);
      return false;
    });
    expect(seen[0]).toBe("https://example.com/foo");
  });
});
