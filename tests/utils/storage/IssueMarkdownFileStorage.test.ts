import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueMarkdownFileStorage } from "../../../src/utils/storage/IssueMarkdownFileStorage.ts";
import { FileService } from "../../../src/services/FileService.ts";
import type { FileService as FileServiceType } from "../../../src/services/FileService.ts";

describe("IssueMarkdownFileStorage", () => {
  let savedFileService: FileServiceType;

  beforeEach(() => {
    savedFileService = FileService.getInstance();
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
  });

  const makeInMemoryFileService = (initial?: Record<string, string>) => {
    const files = new Map<string, string>(Object.entries(initial ?? {}));
    const readFile = jest.fn(async (p: string) => {
      if (!files.has(p)) {
        throw new Error("ENOENT");
      }
      return files.get(p) as string;
    });
    const writeFile = jest.fn(async (p: string, content: string) => {
      files.set(p, content);
    });
    const stat = jest.fn(async (p: string) => ({
      birthtime: new Date("2025-06-01T00:00:00Z"),
      mtime: new Date("2025-07-01T00:00:00Z"),
    }));
    const fileService = { readFile, writeFile, stat } as unknown as FileServiceType;
    FileService.setInstance(fileService);
    return {
      files,
      readFile,
      writeFile,
      stat,
    };
  };

  it("caches parsed values after load() until clear()", async () => {
    const path = "/repo/issues/0001/issue.md";
    const { readFile } = makeInMemoryFileService({
      [path]: "---\ntitle: A\n---\n\nBody\n",
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    storage.getProperty("title");
    storage.getProperty("title");
    expect(readFile).toHaveBeenCalledTimes(1);

    storage.clear();
    expect(storage.getProperty("title")).toBeUndefined();

    await storage.load();
    storage.getProperty("title");
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it("before load(), getters see empty cache; setProperty and save work without load()", async () => {
    const path = "/repo/issues/0001/issue.md";
    const { writeFile, files } = makeInMemoryFileService({
      [path]: "---\ntitle: A\n---\n\nBody\n",
    });
    const storage = new IssueMarkdownFileStorage(path);
    expect(storage.getProperty("title")).toBeUndefined();
    expect(storage.getStatus()).toBeUndefined();
    expect(storage.getParsed().frontmatter).toEqual({});
    storage.setProperty("x", 1);
    await storage.save();
    expect(writeFile).toHaveBeenCalled();
    const written = files.get(path) as string;
    const parsed = matter(written);
    expect(parsed.data.x).toBe(1);
  });

  it("getStatus returns PARSE_ERROR on invalid frontmatter after load()", async () => {
    const path = "/repo/issues/0001/issue.md";
    const error = [
      "---",
      "title: value:",
      "---",
   ]
    makeInMemoryFileService({
      [path]: error.join("\n"),
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    expect(storage.getStatus()).toBe("PARSE_ERROR");
  });

  it("getStatus returns stored status value when parse succeeds", async () => {
    const path = "/repo/issues/0001/issue.md";
    makeInMemoryFileService({
      [path]: "---\nstatus: in_progress\n---\n\nBody\n",
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    expect(storage.getStatus()).toBe("in_progress");
  });

  it("setProperty and save rewrite file and preserve body when parsing failed", async () => {
    const path = "/repo/issues/0001/issue.md";
    const content = [
      "---",
      "title: value:",
      "---",
      "",
      "# Heading",
      "",
      "Body",
   ]

    const originalRaw = content.join("\n");
    const { writeFile, files } = makeInMemoryFileService({
      [path]: originalRaw,
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    storage.setProperty("title", "Fixed");
    await storage.save();

    expect(writeFile).toHaveBeenCalledTimes(1);
    const written = files.get(path) as string;
    expect(written).toContain(originalRaw);

    const parsed = matter(written);
    expect(parsed.data.title).toBe("Fixed");
  });

  it("getProperty returns defaultValue when parse fails after load()", async () => {
    const path = "/repo/issues/0001/issue.md";
    makeInMemoryFileService({
      [path]: "---\n:bad\n---\n\nBody\n",
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    expect(storage.getProperty("title", "fallback")).toBe("fallback");
  });

  it("getTags returns tags array from frontmatter", async () => {
    const path = "/repo/issues/0001/issue.md";
    makeInMemoryFileService({
      [path]: "---\ntags:\n  - bug\n  - urgent\n---\n\nBody\n",
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    expect(storage.getTags()).toEqual(["bug", "urgent"]);
  });

  it("getTags returns empty array when tags missing or parse failed", async () => {
    const path = "/repo/issues/0001/issue.md";
    makeInMemoryFileService({
      [path]: "---\ntitle: A\n---\n\nBody\n",
    });

    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    expect(storage.getTags()).toEqual([]);

    const badPath = "/repo/issues/0002/issue.md";
    makeInMemoryFileService({
      [badPath]: "---\n:bad\n---\n\nBody\n",
    });
    const badStorage = new IssueMarkdownFileStorage(badPath);
    await badStorage.load();
    expect(badStorage.getTags()).toEqual([]);
  });

  it("after save(), getProperty reads updated cache without another readFile", async () => {
    const path = "/repo/issues/0001/issue.md";
    const { readFile } = makeInMemoryFileService({
      [path]: "---\ntitle: A\n---\n\nBody\n",
    });
    const storage = new IssueMarkdownFileStorage(path);
    await storage.load();
    storage.setProperty("title", "B");
    await storage.save();
    expect(storage.getProperty("title")).toBe("B");
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  describe("appendToContent", () => {
    it("appends after existing body with a blank-line separator", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { files } = makeInMemoryFileService({
        [path]: "---\ntitle: A\n---\n\nExisting body\n",
      });
      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      storage.appendToContent("Appended text");
      await storage.save();

      expect(files.get(path)).toEqual(
        [
          "---",
          "title: A",
          "---",
          "",
          "Existing body",
          "",
          "Appended text",
          "",
        ].join("\n"),
      );
    });

    it("appends as the sole body when content is empty", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { files } = makeInMemoryFileService({
        [path]: "---\ntitle: A\n---\n\n",
      });
      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      storage.appendToContent("Only body");
      await storage.save();

      expect(files.get(path)).toEqual(
        ["---", "title: A", "---", "Only body", ""].join("\n"),
      );
    });
  });

  describe("prependToContent", () => {
    it("prepends before existing body with a blank-line separator", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { files } = makeInMemoryFileService({
        [path]: "---\ntitle: A\n---\n\nExisting body\n",
      });
      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      storage.prependToContent("Prepended text");
      await storage.save();

      expect(files.get(path)).toEqual(
        [
          "---",
          "title: A",
          "---",
          "Prepended text",
          "",
          "Existing body",
          "",
        ].join("\n"),
      );
    });

    it("prepends as the sole body when content is empty", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { files } = makeInMemoryFileService({
        [path]: "---\ntitle: A\n---\n\n",
      });
      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      storage.prependToContent("Only body");
      await storage.save();

      expect(files.get(path)).toEqual(
        ["---", "title: A", "---", "Only body", ""].join("\n"),
      );
    });
  });

  describe("getCreatedAt", () => {
    it("returns created_at from frontmatter when valid", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { stat } = makeInMemoryFileService({
        [path]: "---\ncreated_at: 2026-01-15 10:00+08:00\n---\n\nBody\n",
      });

      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      const result = await storage.getCreatedAt();

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(stat).not.toHaveBeenCalled();
    });

    it("falls back to file birthtime when frontmatter created_at invalid or missing", async () => {
      const path = "/repo/issues/0001/issue.md";
      const fileBirth = new Date("2026-02-01T12:00:00Z");
      const { stat } = makeInMemoryFileService({
        [path]: "---\ncreated_at: not-a-date\n---\n\nBody\n",
      });
      stat.mockResolvedValue({
        birthtime: fileBirth,
        mtime: new Date("2025-07-01T00:00:00Z"),
      });

      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      const result = await storage.getCreatedAt();

      expect(result.getTime()).toBe(fileBirth.getTime());
      expect(stat).toHaveBeenCalledWith(path);
    });
  });

  describe("getUpdatedAt", () => {
    it("returns updated_at from frontmatter when valid", async () => {
      const path = "/repo/issues/0001/issue.md";
      const { stat } = makeInMemoryFileService({
        [path]: "---\nupdated_at: 2026-03-20 14:30+08:00\n---\n\nBody\n",
      });

      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      const result = await storage.getUpdatedAt();

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(20);
      expect(stat).not.toHaveBeenCalled();
    });

    it("falls back to file mtime when frontmatter updated_at invalid or missing", async () => {
      const path = "/repo/issues/0001/issue.md";
      const fileMtime = new Date("2026-04-10T08:00:00Z");
      const { stat } = makeInMemoryFileService({
        [path]: "---\ntitle: A\n---\n\nBody\n",
      });
      stat.mockResolvedValue({
        birthtime: new Date("2025-06-01T00:00:00Z"),
        mtime: fileMtime,
      });

      const storage = new IssueMarkdownFileStorage(path);
      await storage.load();
      const result = await storage.getUpdatedAt();

      expect(result.getTime()).toBe(fileMtime.getTime());
      expect(stat).toHaveBeenCalledWith(path);
    });
  });
});
