import { jest } from "@jest/globals";
import { IssueSearcher } from "../../../src/async/search/IssueSearcher.ts";
import { FileService } from "../../../src/services/FileService.ts";
import type { ParsedSearchTerm } from "../../../src/async/search/types.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";

const issueRoot = "/repo/issues";

function issueFolder(label: string, issueId: string = label): IssueFolder {
  return {
    issueId,
    label,
    path: `${issueRoot}/${issueId}`,
  };
}

const existsIssuesMd = (paths: string[]) => (p: string) =>
  Promise.resolve(paths.some((base) => p === `${base}/issue.md`));

describe("IssueSearcher", () => {
  let mockFileService: jest.Mocked<FileService>;
  const issueOnePath = `${issueRoot}/0001/issue.md`;
  const issueTwoPath = `${issueRoot}/0002/issue.md`;

  beforeEach(() => {
    mockFileService = {
      exists: jest.fn(),
      readFile: jest.fn(),
      readdir: jest.fn().mockResolvedValue([]),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      stat: jest.fn(),
      rename: jest.fn(),
      isBinaryFile: jest.fn(),
    } as unknown as jest.Mocked<FileService>;
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    FileService.setInstance(new FileService());
  });

  test("filters by frontmatter field value", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: open\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: closed\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "open", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
    expect(results[0].metadata?.status).toBe("open");
  });

  test("matches status field case-insensitively", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: Planned\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: closed\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "planned", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
    expect(results[0].metadata?.status).toBe("Planned");
  });

  test("matches priority field case-insensitively", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\npriority: High\n---\nIssue one body`);
      }
      return Promise.resolve(`---\npriority: low\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "priority", value: "high", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("excludes status matches case-insensitively when negated", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: Planned\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: closed\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "planned", negated: true },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0002"]);
  });

  test("filters by tag: query against frontmatter tags array", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(
          `---\ntags:\n  - bug\n  - urgent\n---\nIssue one body`,
        );
      }
      return Promise.resolve(`---\nstatus: open\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "tag", value: "bug", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("matches tag field case-insensitively", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(
          `---\ntags:\n  - Bug\n  - urgent\n---\nIssue one body`,
        );
      }
      return Promise.resolve(`---\nstatus: open\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "tag", value: "bug", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("supports negation and phrase matching", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\ntitle: Keep me\nstatus: open\n---\nBody`);
      }
      return Promise.resolve(`---\ntitle: Remove me\nstatus: closed\n---\nBody`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "phrase", value: "Keep me", negated: false },
      { type: "status", value: "closed", negated: true },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("matches numeric text terms against issue numbers without requiring text content match", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "2", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0002"]);
  });

  test("matches numeric text terms against issue numbers with leading zeros ignored", async () => {
    const searcher = new IssueSearcher();
    const folderName = "0113-searching-should-include-the-issue-num";
    const issues = [issueFolder("0113", folderName)];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/${folderName}`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "113", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual([folderName]);
  });

  test("matches under-padded prefixed issue ID against zero-padded folder ID", async () => {
    const searcher = new IssueSearcher();
    const folderName = "MI0386-bug-palettecommanddialog-issue-search";
    const issues = [issueFolder("MI0386", folderName)];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/${folderName}`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "MI386", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual([folderName]);
  });

  test("matches exact padded prefixed issue ID against folder ID", async () => {
    const searcher = new IssueSearcher();
    const folderName = "MI0386-bug-palettecommanddialog-issue-search";
    const issues = [issueFolder("MI0386", folderName)];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/${folderName}`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "MI0386", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual([folderName]);
  });

  test("does not match prefixed issue ID with a different prefix", async () => {
    const searcher = new IssueSearcher();
    const folderName = "MI0386-bug-palettecommanddialog-issue-search";
    const issues = [issueFolder("MI0386", folderName)];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/${folderName}`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "XX386", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results).toEqual([]);
  });

  test("does not match numeric text terms against partial issue numbers", async () => {
    const searcher = new IssueSearcher();
    const folderName = "0113-searching-should-include-the-issue-num";
    const issues = [issueFolder("0113", folderName)];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/${folderName}`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "13", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results).toEqual([]);
  });

  test("supports negated numeric text terms against issue numbers", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nBody`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "text", value: "2", negated: true },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("supports date comparisons against createdAt", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nIssue body`);
    mockFileService.stat.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve({
          birthtime: new Date("2026-01-10"),
          mtime: new Date("2026-01-12"),
        } as unknown as { birthtime: Date; mtime: Date });
      }
      return Promise.resolve({
        birthtime: new Date("2025-12-20"),
        mtime: new Date("2026-01-02"),
      } as unknown as { birthtime: Date; mtime: Date });
    });

    const terms: ParsedSearchTerm[] = [
      { type: "createdAt", value: ">=2026-01-01", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("returns results sorted by id descending", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002"), issueFolder("0003")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`, `${issueRoot}/0003`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nIssue body`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "open", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((r) => r.issueId)).toEqual(["0003", "0002", "0001"]);
  });

  test("skips folders without issue file", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002-no-md"), issueFolder("0003")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0003`]),
    );
    mockFileService.readFile.mockResolvedValue(`---\nstatus: open\n---\nIssue body`);
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const results = await searcher.search(issues, []);

    expect(results.map((r) => r.issueId)).toEqual(["0003", "0001"]);
    expect(mockFileService.readFile).toHaveBeenCalledTimes(4);
  });

  test("enriches title, status, createdAt and updatedAt", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001")];
    mockFileService.exists.mockImplementation(existsIssuesMd([`${issueRoot}/0001`]));
    mockFileService.readFile.mockResolvedValue(
      `---\ntitle: My Issue Title\nstatus: in-progress\n---\nBody`,
    );
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-02-15T12:00:00.000Z"),
    } as unknown as { birthtime: Date; mtime: Date });

    const results = await searcher.search(issues, []);

    expect(results).toHaveLength(1);
    expect(results[0].metadata?.title).toBe("My Issue Title");
    expect(results[0].metadata?.status).toBe("in-progress");
    expect(results[0].metadata?.createdAt).toEqual(new Date("2026-01-01"));
    expect(results[0].metadata?.updatedAt).toEqual(
      new Date("2026-02-15T12:00:00.000Z"),
    );
    expect(results[0].metadata?.frontmatter).toEqual({
      title: "My Issue Title",
      status: "in-progress",
    });
  });

  test("enriches createdAt and updatedAt from frontmatter over file stat", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001")];
    mockFileService.exists.mockImplementation(existsIssuesMd([`${issueRoot}/0001`]));
    mockFileService.readFile.mockResolvedValue(
      `---\ncreated_at: 2026-03-01 10:00+08:00\nupdated_at: 2026-04-01 12:00+08:00\n---\nBody`,
    );
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2025-01-01"),
      mtime: new Date("2025-02-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const results = await searcher.search(issues, []);

    expect(results).toHaveLength(1);
    expect(results[0].metadata?.createdAt?.getFullYear()).toBe(2026);
    expect(results[0].metadata?.createdAt?.getMonth()).toBe(2);
    expect(results[0].metadata?.createdAt?.getDate()).toBe(1);
    expect(results[0].metadata?.updatedAt?.getFullYear()).toBe(2026);
    expect(results[0].metadata?.updatedAt?.getMonth()).toBe(3);
    expect(results[0].metadata?.updatedAt?.getDate()).toBe(1);
  });

  test("supports date comparisons against updatedAt from frontmatter", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(
          `---\nupdated_at: 2026-02-01 10:00+08:00\n---\nIssue body`,
        );
      }
      return Promise.resolve(`---\nstatus: open\n---\nIssue body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2025-01-01"),
      mtime: new Date("2025-12-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "updatedAt", value: ">=2026-01-01", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("status:resolved matches issues whose status is in the resolved list", async () => {
    const searcher = new IssueSearcher();
    const issues = [
      issueFolder("0001"),
      issueFolder("0002"),
      issueFolder("0003"),
    ];
    const issueThreePath = `${issueRoot}/0003/issue.md`;
    mockFileService.exists.mockImplementation(
      existsIssuesMd([
        `${issueRoot}/0001`,
        `${issueRoot}/0002`,
        `${issueRoot}/0003`,
      ]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: closed\n---\nIssue one body`);
      }
      if (path === issueTwoPath) {
        return Promise.resolve(`---\nstatus: open\n---\nIssue two body`);
      }
      if (path === issueThreePath) {
        return Promise.resolve(`---\nstatus: canceled\n---\nIssue three body`);
      }
      return Promise.resolve(`---\nstatus: open\n---\nBody`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "resolved", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0003", "0001"]);
  });

  test("status:resolved does not match non-resolved statuses", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: open\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: in_progress\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "resolved", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual([]);
  });

  test("-status:resolved excludes issues in the resolved list", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: closed\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: open\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "resolved", negated: true },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0002"]);
  });

  test("status:resolved respects a custom resolvedStatusList", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: done\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: closed\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "resolved", negated: false },
    ];
    const results = await searcher.search(issues, terms, {
      resolvedStatusList: ["done", "wontfix"],
    });

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("status:resolved matches alias and list values case-insensitively", async () => {
    const searcher = new IssueSearcher();
    const issues = [issueFolder("0001"), issueFolder("0002")];
    mockFileService.exists.mockImplementation(
      existsIssuesMd([`${issueRoot}/0001`, `${issueRoot}/0002`]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\nstatus: Closed\n---\nIssue one body`);
      }
      return Promise.resolve(`---\nstatus: open\n---\nIssue two body`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "Resolved", negated: false },
    ];
    const results = await searcher.search(issues, terms, {
      resolvedStatusList: ["closed", "canceled"],
    });

    expect(results.map((x) => x.issueId)).toEqual(["0001"]);
  });

  test("status:resolved does not match missing or empty status", async () => {
    const searcher = new IssueSearcher();
    const issues = [
      issueFolder("0001"),
      issueFolder("0002"),
      issueFolder("0003"),
    ];
    const issueThreePath = `${issueRoot}/0003/issue.md`;
    mockFileService.exists.mockImplementation(
      existsIssuesMd([
        `${issueRoot}/0001`,
        `${issueRoot}/0002`,
        `${issueRoot}/0003`,
      ]),
    );
    mockFileService.readFile.mockImplementation((path) => {
      if (path === issueOnePath) {
        return Promise.resolve(`---\ntitle: No status\n---\nIssue one body`);
      }
      if (path === issueTwoPath) {
        return Promise.resolve(`---\nstatus: ""\n---\nIssue two body`);
      }
      if (path === issueThreePath) {
        return Promise.resolve(`---\nstatus: closed\n---\nIssue three body`);
      }
      return Promise.resolve(`---\nstatus: open\n---\nBody`);
    });
    mockFileService.stat.mockResolvedValue({
      birthtime: new Date("2026-01-01"),
      mtime: new Date("2026-01-01"),
    } as unknown as { birthtime: Date; mtime: Date });

    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "resolved", negated: false },
    ];
    const results = await searcher.search(issues, terms);

    expect(results.map((x) => x.issueId)).toEqual(["0003"]);
  });
});
