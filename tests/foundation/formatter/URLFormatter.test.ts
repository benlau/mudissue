import { URLFormatter } from "../../../src/foundation/formatter/URLFormatter.ts";

describe("URLFormatter", () => {
  describe("removeTrailingSlash", () => {
    it("removes a single trailing slash", () => {
      expect(URLFormatter.removeTrailingSlash("file:///tmp/foo/")).toBe(
        "file:///tmp/foo",
      );
    });

    it("leaves URLs without trailing slash unchanged", () => {
      expect(URLFormatter.removeTrailingSlash("file:///tmp/foo")).toBe(
        "file:///tmp/foo",
      );
    });
  });

  describe("normalizeRegistryUrl", () => {
    test("returns file URL for path and strips trailing slash", () => {
      const url = URLFormatter.normalizeRegistryUrl("/tmp/foo", "/tmp");
      expect(url).toMatch(/file:\/\/.+/);
      expect(url.endsWith("/")).toBe(false);
    });

    test("parses http and https URLs and strips trailing slash", () => {
      expect(
        URLFormatter.normalizeRegistryUrl("http://example.com/", "/tmp"),
      ).toBe("http://example.com");
      expect(
        URLFormatter.normalizeRegistryUrl(
          "https://example.com/path/",
          "/tmp",
        ),
      ).toBe("https://example.com/path");
    });

    test("parses file URL input", () => {
      const fromPath = URLFormatter.normalizeRegistryUrl("/tmp/foo", "/tmp");
      expect(URLFormatter.normalizeRegistryUrl(fromPath, "/tmp")).toBe(fromPath);
    });

    test("treats Windows drive paths as filesystem paths", () => {
      const url = URLFormatter.normalizeRegistryUrl("C:/foo", "/tmp");
      expect(url).toMatch(/^file:\/\//);
      expect(url).not.toMatch(/^https?:/);
    });
  });
});
