import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueTagCommand } from "../../src/commands/IssueTagCommand.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueTagCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let mockLogger: jest.Mocked<Pick<LoggerService, "info">>;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService.find.mockResolvedValue([]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    mockLogger = { info: jest.fn() };
    LoggerService.setInstance(mockLogger as unknown as LoggerService);
  });

  afterEach(() => {
    LoggerService.setInstance(null);
  });

  it("returns current tags without writing when no tags provided", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.readFile.mockResolvedValue(
      "---\ntags:\n  - existing\n  - other\n---\n\nBody\n",
    );

    const cmd = new IssueTagCommand();
    const result = await cmd.command({ issueSelector: "0001", tags: [] });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.issueFolder).toBe("/repo/issues/0001-test");
      expect(result.result.tags).toEqual(["existing", "other"]);
    }
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });

  it("returns empty tags when issue has no tags field", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.readFile.mockResolvedValue("---\ntitle: Test\n---\n\nBody\n");

    const cmd = new IssueTagCommand();
    const result = await cmd.command({ issueSelector: "0001", tags: [] });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual([]);
    }
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("throws ISSUE_NOT_FOUND when issue selector is missing", async () => {
    const cmd = new IssueTagCommand();

    await expect(cmd.command({ issueSelector: "", tags: [] })).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws ISSUE_NOT_FOUND when selector matches none", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const cmd = new IssueTagCommand();

    await expect(
      cmd.command({ issueSelector: "999", tags: ["foo"] }),
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
    const cmd = new IssueTagCommand();

    await expect(
      cmd.command({ issueSelector: "0001", tags: ["foo"] }),
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

    const cmd = new IssueTagCommand();
    await expect(
      cmd.command({ issueSelector: "0001", tags: ["foo"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MD_MISSING" },
    });
  });

  it("appends tags to frontmatter and returns final tags", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntags:\n  - existing\n---\n\nBody\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    const cmd = new IssueTagCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      tags: ["existing", "new"],
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual(["existing", "new"]);
    }
    expect(mockLogger.info).toHaveBeenCalledTimes(2);

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.tags).toEqual(["existing", "new"]);
  });

  it("creates tags array when missing", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntitle: Test\n---\n\nBody\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    const cmd = new IssueTagCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      tags: ["a", "b"],
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual(["a", "b"]);
    }
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });
});
