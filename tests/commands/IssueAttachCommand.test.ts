import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueAttachCommand } from "../../src/commands/IssueAttachCommand.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import type { FileService } from "../../src/services/FileService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("IssueAttachCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService = bundle.issueFinderService;
    loggerService = bundle.loggerService;

    LoggerService.setInstance(loggerService as unknown as LoggerService);

    shellService.cwd.mockReturnValue("/cwd");
    shellService.isAbsolute.mockReturnValue(false);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    });
    issueFinderService.find.mockResolvedValue([]);
  });

  afterEach(() => {
    LoggerService.setInstance(new LoggerService());
  });

  it("throws ISSUE_NOT_FOUND when selector matches none", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const cmd = new IssueAttachCommand();

    await expect(
      cmd.command({ issueSelector: "999", files: ["a.txt"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws ISSUE_MULTI_MATCHED when selector matches multiple", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-a", label: "0001", path: "/repo/issues/0001-a",
       },
      { issueId: "0001-b", label: "0001", path: "/repo/issues/0001-b",
       },
    ]);
    const cmd = new IssueAttachCommand();

    await expect(
      cmd.command({ issueSelector: "0001", files: ["a.txt"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
  });

    it("throws ISSUE_MD_MISSING when issue file cannot be found", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const cmd = new IssueAttachCommand();
    await expect(
      cmd.command({ issueSelector: "0001", files: ["a.txt"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MD_MISSING" },
    });
  });

  it("throws ATTACH_FILE_NOT_FOUND when source file does not exist", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockImplementation(async (p: string) => {
      if (p === "/repo/issues/0001-test/issue.md") return true;
      if (p === "/cwd/missing.txt") return false;
      return false;
    });

    const cmd = new IssueAttachCommand();
    await expect(
      cmd.command({ issueSelector: "0001", files: ["missing.txt"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ATTACH_FILE_NOT_FOUND" },
    });
  });

  it("copies files to issue files/ folder and appends wikilinks to frontmatter", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);

    fileService.exists.mockImplementation(async (p: string) => {
      if (p === "/repo/issues/0001-test/issue.md") return true;
      if (p === "/cwd/a.txt") return true;
      if (p === "/cwd/b.png") return true;
      if (p === "/repo/issues/0001-test/files/a.txt") return false;
      if (p === "/repo/issues/0001-test/files/b.png") return false;
      return false;
    });
    fileService.stat.mockResolvedValue({
      isFile: () => true,
    } as Awaited<ReturnType<FileService["stat"]>>);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue("---\ntitle: Test\n---\n\nBody\n");

    const cmd = new IssueAttachCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      files: ["a.txt", "b.png"],
    });

    expect(result.status).toBe("ok");
    expect(fileService.mkdir).toHaveBeenCalledWith(
      "/repo/issues/0001-test/files",
      { recursive: true },
    );
    expect(fileService.copyFile).toHaveBeenCalledWith(
      "/cwd/a.txt",
      "/repo/issues/0001-test/files/a.txt",
    );
    expect(fileService.copyFile).toHaveBeenCalledWith(
      "/cwd/b.png",
      "/repo/issues/0001-test/files/b.png",
    );

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.attachments).toEqual(["[[a]]", "[[b.png]]"]);
  });
});
