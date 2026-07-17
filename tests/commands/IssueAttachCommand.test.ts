import { jest } from "@jest/globals";
import * as path from "path";
import matter from "gray-matter";
import { IssueAttachCommand } from "../../src/commands/IssueAttachCommand.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import type { FileService } from "../../src/services/FileService.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "repo",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const mudissueWorktreePath = path.join(
  mockRepo.projectPath,
  ".claude",
  "worktrees",
  "MI0100-mudissue",
);

describe("IssueAttachCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    gitService = bundle.gitService;
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService = bundle.issueFinderService;
    loggerService = bundle.loggerService;

    LoggerService.setInstance(loggerService as unknown as LoggerService);

    shellService.cwd.mockReturnValue("/cwd");
    shellService.isAbsolute.mockReturnValue(false);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    issueFinderService.find.mockResolvedValue([]);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
    ]);
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

  it("resolves current from the cwd mudissue worktree and attaches the file", async () => {
    const issue = {
      issueId: "MI0100-mudissue",
      label: "MI0100",
      path: "/repo/issues/MI0100-mudissue",
    };
    const sourcePath = path.join(mudissueWorktreePath, "a.txt");

    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    shellService.isAbsolute.mockImplementation((p: string) =>
      path.isAbsolute(p),
    );
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    fileService.exists.mockImplementation(async (p: string) => {
      if (p === "/repo/issues/MI0100-mudissue/issue.md") return true;
      if (p === sourcePath) return true;
      if (p === "/repo/issues/MI0100-mudissue/files/a.txt") return false;
      return false;
    });
    fileService.stat.mockResolvedValue({
      isFile: () => true,
    } as Awaited<ReturnType<FileService["stat"]>>);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(
      "---\ntitle: Current Attach\n---\n\nBody\n",
    );

    const cmd = new IssueAttachCommand();
    const result = await cmd.command({
      issueSelector: "current",
      files: ["a.txt"],
    });

    expect(result.status).toBe("ok");
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue");
    expect(fileService.copyFile).toHaveBeenCalledWith(
      sourcePath,
      "/repo/issues/MI0100-mudissue/files/a.txt",
    );

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.attachments).toEqual(["[[a]]"]);
  });

  it("prefixes attachment filenames with the issue label when --add-label is set", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "FN004-test",
        label: "FN004",
        path: "/repo/issues/FN004-test",
      },
    ]);

    fileService.exists.mockImplementation(async (p: string) => {
      if (p === "/repo/issues/FN004-test/issue.md") return true;
      if (p === "/cwd/a.txt") return true;
      if (p === "/cwd/b.png") return true;
      if (p === "/repo/issues/FN004-test/files/FN004-a.txt") return false;
      if (p === "/repo/issues/FN004-test/files/FN004-b.png") return false;
      return false;
    });
    fileService.stat.mockResolvedValue({
      isFile: () => true,
    } as Awaited<ReturnType<FileService["stat"]>>);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(
      "---\ntitle: Add Label Attach\n---\n\nBody\n",
    );

    const cmd = new IssueAttachCommand();
    const result = await cmd.command({
      issueSelector: "FN004",
      files: ["a.txt", "b.png"],
      addLabel: true,
    });

    expect(result.status).toBe("ok");
    expect(fileService.copyFile).toHaveBeenCalledWith(
      "/cwd/a.txt",
      "/repo/issues/FN004-test/files/FN004-a.txt",
    );
    expect(fileService.copyFile).toHaveBeenCalledWith(
      "/cwd/b.png",
      "/repo/issues/FN004-test/files/FN004-b.png",
    );

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.attachments).toEqual(["[[FN004-a]]", "[[FN004-b.png]]"]);
  });

  it("applies collision suffixes after the label prefix when --add-label is set", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "FN004-test",
        label: "FN004",
        path: "/repo/issues/FN004-test",
      },
    ]);

    fileService.exists.mockImplementation(async (p: string) => {
      if (p === "/repo/issues/FN004-test/issue.md") return true;
      if (p === "/cwd/a.txt") return true;
      if (p === "/repo/issues/FN004-test/files/FN004-a.txt") return true;
      if (p === "/repo/issues/FN004-test/files/FN004-a-1.txt") return false;
      return false;
    });
    fileService.stat.mockResolvedValue({
      isFile: () => true,
    } as Awaited<ReturnType<FileService["stat"]>>);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(
      "---\ntitle: Add Label Collision\n---\n\nBody\n",
    );

    const cmd = new IssueAttachCommand();
    const result = await cmd.command({
      issueSelector: "FN004",
      files: ["a.txt"],
      addLabel: true,
    });

    expect(result.status).toBe("ok");
    expect(fileService.copyFile).toHaveBeenCalledWith(
      "/cwd/a.txt",
      "/repo/issues/FN004-test/files/FN004-a-1.txt",
    );

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.attachments).toEqual(["[[FN004-a-1]]"]);
  });
});
