import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { FileService } from "../../../src/services/FileService.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";

describe("IssueFolderStorage", () => {
  let mockFileService: jest.Mocked<FileService>;
  let savedFileService: FileService;
  const folderAbsPath = "/repo/issues/0001";
  const buildIssueFolder = (): IssueFolder => ({ issueId: "0001", label: "0001", path: folderAbsPath,
   });

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    mockFileService = {
      exists: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      mkdir: jest.fn(),
      rm: jest.fn(),
      rmdir: jest.fn(),
    } as unknown as jest.Mocked<FileService>;
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
  });

  describe("findIssueFile", () => {
    it("returns path to issue.md when it exists", async () => {
      mockFileService.exists.mockImplementation((p: string) =>
        Promise.resolve(p === `${folderAbsPath}/issue.md`),
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.findIssueFile();

      expect(result).toBe(`${folderAbsPath}/issue.md`);
      expect(mockFileService.exists).toHaveBeenCalledWith(`${folderAbsPath}/issue.md`);
    });

    it("returns path to folderName.md when issue.md not found", async () => {
      mockFileService.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.findIssueFile();

      expect(result).toBe(`${folderAbsPath}/0001.md`);
    });

    it("returns path to issueId.md when issue.md and label.md not found", async () => {
      // Make issueId (full folder basename) different from label
      const folder: IssueFolder = { issueId: "FX0001-rename", label: "FX0001", path: "/repo/issues/FX0001-rename",
       };

      mockFileService.exists
        .mockResolvedValueOnce(false) // issue.md
        .mockResolvedValueOnce(false) // label.md
        .mockResolvedValueOnce(true); // issueId.md

      const storage = new IssueFolderStorage(folder);
      const result = await storage.findIssueFile();

      expect(result).toBe("/repo/issues/FX0001-rename/FX0001-rename.md");
    });

    it("returns path to issueId-suffix.md when issue.md and direct .md files not found", async () => {
      const folder: IssueFolder = { issueId: "FX0001-rename", label: "FX0001", path: "/repo/issues/FX0001-rename",
       };

      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([
        { name: "FX0001-summary.md", isDirectory: () => false },
        { name: "other.md", isDirectory: () => false },
      ] as any);

      const storage = new IssueFolderStorage(folder);
      const result = await storage.findIssueFile();

      expect(result).toBe("/repo/issues/FX0001-rename/FX0001-summary.md");
    });

    it("returns undefined when no matching file exists", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([
        { name: "other.md", isDirectory: () => false },
      ] as any);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.findIssueFile();

      expect(result).toBeUndefined();
    });
  });

  describe("readIssue", () => {
    it("returns content of issue file from findIssueFile", async () => {
      const content = "---\ntitle: Test\n---\n# Body";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(content);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.readIssue();

      expect(result).toBe(content);
      expect(mockFileService.readFile).toHaveBeenCalledWith(
        `${folderAbsPath}/issue.md`,
        "utf-8",
      );
    });

    it("throws when no issue file found", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);

      const storage = new IssueFolderStorage(buildIssueFolder());

      await expect(storage.readIssue()).rejects.toThrow();
    });
  });

  describe("getCreatedAt", () => {
    it("returns created_at from frontmatter when valid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\ncreated_at: 2026-01-15 10:00+08:00\n---\n",
      );
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: new Date("2025-01-01"),
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getCreatedAt();

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("returns file birthtime when frontmatter created_at invalid", async () => {
      const fileBirth = new Date("2026-02-01T12:00:00Z");
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\ncreated_at: not-a-date\n---\n",
      );
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: fileBirth,
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getCreatedAt();

      expect(result.getTime()).toBe(fileBirth.getTime());
    });

    it("returns folder birthtime when no issue file exists", async () => {
      const folderBirth = new Date("2026-01-10T00:00:00Z");
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: folderBirth,
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getCreatedAt();

      expect(result.getTime()).toBe(folderBirth.getTime());
      expect(mockFileService.stat).toHaveBeenCalledWith(folderAbsPath);
    });
  });

  describe("getUpdatedAt", () => {
    it("returns updated_at from frontmatter when valid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nupdated_at: 2026-03-20 14:30+08:00\n---\n",
      );
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: new Date("2025-01-01"),
        mtime: new Date("2025-02-01"),
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getUpdatedAt();

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(20);
    });

    it("returns file mtime when frontmatter updated_at invalid", async () => {
      const fileMtime = new Date("2026-04-10T08:00:00Z");
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nupdated_at: not-a-date\n---\n",
      );
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: new Date("2025-01-01"),
        mtime: fileMtime,
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getUpdatedAt();

      expect(result.getTime()).toBe(fileMtime.getTime());
    });

    it("returns folder mtime when no issue file exists", async () => {
      const folderMtime = new Date("2026-05-15T00:00:00Z");
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        mtime: folderMtime,
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.getUpdatedAt();

      expect(result.getTime()).toBe(folderMtime.getTime());
      expect(mockFileService.stat).toHaveBeenCalledWith(folderAbsPath);
    });
  });

  describe("getCreatedAt and getUpdatedAt", () => {
    it("caches loaded storage so getCreatedAt and getUpdatedAt share one readFile", async () => {
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\ntitle: Test\n---\n",
      );
      (mockFileService.stat as jest.Mock).mockResolvedValue({
        birthtime: new Date("2026-01-01"),
        mtime: new Date("2026-02-01"),
      });

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.getCreatedAt();
      await storage.getUpdatedAt();

      expect(mockFileService.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("touchUpdatedAt", () => {
    it("writes updated_at to frontmatter", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const now = new Date("2026-05-24T12:00:00.000Z");
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\ntitle: An issue\n---\n\n# Body\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.touchUpdatedAt(now);

      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        issuePath,
        expect.stringMatching(/updated_at:/),
      );
    });
  });

  describe("touchUpdatedAtIfNotSuperseded", () => {
    it("writes updated_at when stored value is older than candidate", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const candidate = new Date("2026-07-06T12:00:00+08:00");
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nupdated_at: 2026-03-20 14:30+08:00\n---\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.touchUpdatedAtIfNotSuperseded(candidate);

      expect(result).not.toBeNull();
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        issuePath,
        expect.stringMatching(/updated_at:/),
      );
    });

    it("does not write when stored updated_at is newer than candidate", async () => {
      const candidate = new Date("2026-03-20 14:30+08:00");
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nupdated_at: 2026-07-06 12:00+08:00\n---\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const result = await storage.touchUpdatedAtIfNotSuperseded(candidate);

      expect(result).toBeNull();
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("appendSubissue", () => {
    it("appends new folder name to existing subissues array", async () => {
      const parentPath = `${folderAbsPath}/issue.md`;
      const existingContent =
        "---\nsubissues:\n  - FX0080-xxx\n  - 0012-xxx\n---\n\n# Parent\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendSubissue("0003-new-child", "fixed");

      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        parentPath,
        expect.stringContaining("0003-new-child"),
      );
      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.subissues).toEqual([
        "FX0080-xxx",
        "0012-xxx",
        "0003-new-child",
      ]);
    });

    it("creates subissues array when missing", async () => {
      const parentPath = `${folderAbsPath}/issue.md`;
      const existingContent = "---\ntitle: Parent\n---\n\nBody\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendSubissue("002-child", "fixed");

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.subissues).toBe("002-child");
    });

    it("wraps folder name for long pattern", async () => {
      const existingContent = "---\ntitle: Parent\n---\n\nBody\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendSubissue("002-child", "long");

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.subissues).toBe("[[002-child]]");
    });

    it("does not duplicate when folder name already in subissues", async () => {
      const existingContent =
        "---\nsubissues:\n  - FX0080-xxx\n  - 0012-xxx\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendSubissue("0012-xxx", "fixed");

      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });

    it("does not duplicate when bare name matches existing wikilink entry", async () => {
      const existingContent =
        "---\nsubissues:\n  - [[0012-xxx]]\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendSubissue("0012-xxx", "long");

      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });

    it("throws when no issue file found", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);

      const storage = new IssueFolderStorage(buildIssueFolder());

      await expect(storage.appendSubissue("002-child", "fixed")).rejects.toThrow(
        /No issue file found/,
      );
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("applyLinkage and removeLinkage", () => {
    it("writes first link as a string and promotes to list on second link", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\ntitle: Issue\n---\n\nBody\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.applyLinkage("blocking", "0002-other", "long");

      let written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      expect(matter(written).data.blocking).toBe("[[0002-other]]");

      (mockFileService.readFile as jest.Mock).mockResolvedValue(written);
      await storage.applyLinkage("blocking", "0003-third", "long");

      written = (mockFileService.writeFile as jest.Mock).mock.calls[1][1] as string;
      expect(matter(written).data.blocking).toEqual([
        "[[0002-other]]",
        "[[0003-third]]",
      ]);
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        issuePath,
        expect.any(String),
      );
    });

    it("unlink collapses a single-entry list back to string", async () => {
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nblocking:\n  - [[0002-other]]\n  - [[0003-third]]\n---\n\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.removeLinkage("blocking", "0003-third", "long");

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      expect(matter(written).data.blocking).toBe("0002-other");
    });

    it("unlink removes string field when target matches", async () => {
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(
        "---\nparent: [[0002-parent]]\n---\n\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.removeLinkage("parent", "0002-parent", "long");

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      expect(matter(written).data.parent).toBeUndefined();
    });
  });

  describe("appendAttachments", () => {
    it("appends formatted wikilinks to existing attachments array", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const existingContent =
        "---\nattachments:\n  - '[[foo.png]]'\n  - '[[bar]]'\n---\n\n# Body\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendAttachments(["baz.pdf"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.attachments).toEqual([
        "[[foo.png]]",
        "[[bar]]",
        "[[baz.pdf]]",
      ]);
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        issuePath,
        expect.any(String),
      );
    });

    it("creates attachments array when missing", async () => {
      const existingContent = "---\ntitle: Issue\n---\n\nBody\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendAttachments(["a.png", "b.txt"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.attachments).toEqual(["[[a.png]]", "[[b]]"]);
    });

    it("does not duplicate attachments with the same compare key", async () => {
      const existingContent = "---\nattachments:\n  - '[[foo.png]]'\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendAttachments(["foo.png", "bar.txt"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.attachments).toEqual(["[[foo.png]]", "[[bar]]"]);
    });

    it("does not duplicate when bare text filename matches existing wikilink", async () => {
      const existingContent = "---\nattachments:\n  - '[[bar]]'\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendAttachments(["bar.txt"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.attachments).toEqual(["[[bar]]"]);
    });

    it("throws when no issue file found", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);

      const storage = new IssueFolderStorage(buildIssueFolder());

      await expect(storage.appendAttachments(["x.png"])).rejects.toThrow(
        /No issue file found/,
      );
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("ensureAttachmentsDir", () => {
    it("creates files/ and returns its path", async () => {
      mockFileService.mkdir.mockResolvedValue(undefined);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const dir = await storage.ensureAttachmentsDir();

      expect(dir).toEqual(`${folderAbsPath}/files`);
      expect(mockFileService.mkdir).toHaveBeenCalledWith(
        `${folderAbsPath}/files`,
        { recursive: true },
      );
    });
  });

  describe("listFiles", () => {
    it("returns attachment paths when attachments option is set", async () => {
      const filesDir = `${folderAbsPath}/files`;
      mockFileService.exists.mockImplementation(async (p: string) => {
        if (p === `${folderAbsPath}/issue.md`) return true;
        if (p === `${filesDir}/a.png`) return true;
        if (p === `${filesDir}/notes.txt`) return true;
        return false;
      });
      mockFileService.readFile.mockResolvedValue(
        "---\nattachments:\n  - '[[a.png]]'\n  - '[[notes]]'\n---\n\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const paths = await storage.listFiles({ attachments: true });

      expect(paths).toEqual([`${filesDir}/a.png`, `${filesDir}/notes.txt`]);
      expect(mockFileService.readdir).not.toHaveBeenCalled();
    });

    it("returns the issue file path when issue_file option is set", async () => {
      mockFileService.exists.mockImplementation(async (p: string) =>
        p === `${folderAbsPath}/issue.md`,
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const paths = await storage.listFiles({ issueMarkdownFile: true });

      expect(paths).toEqual([`${folderAbsPath}/issue.md`]);
      expect(mockFileService.readFile).not.toHaveBeenCalled();
    });

    it("returns attachments and issue file when both options are set", async () => {
      const filesDir = `${folderAbsPath}/files`;
      mockFileService.exists.mockImplementation(async (p: string) => {
        if (p === `${folderAbsPath}/issue.md`) return true;
        if (p === `${filesDir}/a.png`) return true;
        return false;
      });
      mockFileService.readFile.mockResolvedValue(
        "---\nattachments:\n  - '[[a.png]]'\n---\n\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const paths = await storage.listFiles({
        attachments: true,
        issueMarkdownFile: true,
      });

      expect(paths).toEqual([
        `${filesDir}/a.png`,
        `${folderAbsPath}/issue.md`,
      ]);
    });
  });

  describe("remove", () => {
    it("removes attachments then issue markdown and folder", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const filesDir = `${folderAbsPath}/files`;
      mockFileService.exists.mockImplementation(async (p: string) =>
        p === issuePath || p === `${filesDir}/a.png`,
      );
      mockFileService.readFile.mockResolvedValue(
        "---\nattachments:\n  - '[[a.png]]'\n---\n\n",
      );
      mockFileService.rm.mockResolvedValue(undefined);
      mockFileService.rmdir.mockResolvedValue(undefined);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const removed = await storage.remove();

      expect(removed).toEqual([
        `${filesDir}/a.png`,
        filesDir,
        issuePath,
        folderAbsPath,
      ]);
      expect(mockFileService.readdir).not.toHaveBeenCalled();
    });

    it("skips files/ rmdir when there are no attachments", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      mockFileService.exists.mockImplementation(async (p: string) =>
        p === issuePath,
      );
      mockFileService.readFile.mockResolvedValue("---\ntitle: Test\n---\n\n");
      mockFileService.rm.mockResolvedValue(undefined);
      mockFileService.rmdir.mockResolvedValue(undefined);

      const storage = new IssueFolderStorage(buildIssueFolder());
      const removed = await storage.remove();

      expect(removed).toEqual([issuePath, folderAbsPath]);
      expect(mockFileService.rmdir).toHaveBeenCalledWith(folderAbsPath);
      expect(mockFileService.rmdir).toHaveBeenCalledTimes(1);
    });

    it("dry-run returns paths without deleting files or directories", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const filesDir = `${folderAbsPath}/files`;
      mockFileService.exists.mockImplementation(async (p: string) =>
        p === issuePath || p === `${filesDir}/a.png`,
      );
      mockFileService.readFile.mockResolvedValue(
        "---\nattachments:\n  - '[[a.png]]'\n---\n\n",
      );

      const storage = new IssueFolderStorage(buildIssueFolder());
      const removed = await storage.remove({ dryRun: true });

      expect(removed).toEqual([
        `${filesDir}/a.png`,
        filesDir,
        issuePath,
        folderAbsPath,
      ]);
      expect(mockFileService.rm).not.toHaveBeenCalled();
      expect(mockFileService.rmdir).not.toHaveBeenCalled();
    });
  });

  describe("appendTags", () => {
    it("appends new tags to existing tags array", async () => {
      const issuePath = `${folderAbsPath}/issue.md`;
      const existingContent =
        "---\ntags:\n  - foo\n  - bar\n---\n\n# Body\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendTags(["baz"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.tags).toEqual(["foo", "bar", "baz"]);
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        issuePath,
        expect.any(String),
      );
    });

    it("creates tags array when missing", async () => {
      const existingContent = "---\ntitle: Issue\n---\n\nBody\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendTags(["a", "b"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.tags).toEqual(["a", "b"]);
    });

    it("does not duplicate existing tags", async () => {
      const existingContent = "---\ntags:\n  - foo\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.appendTags(["foo", "bar"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.tags).toEqual(["foo", "bar"]);
    });

    it("throws when no issue file found", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);

      const storage = new IssueFolderStorage(buildIssueFolder());

      await expect(storage.appendTags(["x"])).rejects.toThrow(
        /No issue file found/,
      );
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("removeTags", () => {
    it("removes tags from existing array", async () => {
      const existingContent = "---\ntags:\n  - foo\n  - bar\n  - baz\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.removeTags(["foo", "baz"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.tags).toEqual(["bar"]);
    });

    it("removes tags key when array becomes empty", async () => {
      const existingContent = "---\ntags:\n  - only\n---\n\n";
      mockFileService.exists.mockResolvedValue(true);
      (mockFileService.readFile as jest.Mock).mockResolvedValue(existingContent);

      const storage = new IssueFolderStorage(buildIssueFolder());
      await storage.removeTags(["only"]);

      const written = (mockFileService.writeFile as jest.Mock).mock.calls[0][1] as string;
      const parsed = matter(written);
      expect(parsed.data.tags).toBeUndefined();
    });

    it("throws when no issue file found", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.readdir.mockResolvedValue([]);

      const storage = new IssueFolderStorage(buildIssueFolder());

      await expect(storage.removeTags(["x"])).rejects.toThrow(
        /No issue file found/,
      );
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });
});
