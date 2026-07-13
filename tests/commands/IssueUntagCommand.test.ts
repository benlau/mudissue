import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueUntagCommand } from "../../src/commands/IssueUntagCommand.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueUntagCommand", () => {
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
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.readFile.mockResolvedValue(
      "---\ntags:\n  - keep\n  - remove\n---\n\nBody\n",
    );

    const cmd = new IssueUntagCommand();
    const result = await cmd.command({ issueSelector: "0001", tags: [] });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual(["keep", "remove"]);
    }
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });

  it("throws ISSUE_NOT_FOUND when selector matches none", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const cmd = new IssueUntagCommand();

    await expect(
      cmd.command({ issueSelector: "999", tags: ["foo"] }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("removes tags and deletes tags key when empty", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntags:\n  - only\n---\n\nBody\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    const cmd = new IssueUntagCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      tags: ["only"],
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual([]);
    }
    expect(mockLogger.info).not.toHaveBeenCalled();

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.tags).toBeUndefined();
  });

  it("removes only requested tags and leaves others", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntags:\n  - keep\n  - remove\n---\n\nBody\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    const cmd = new IssueUntagCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      tags: ["remove", "missing"],
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.tags).toEqual(["keep"]);
    }
    expect(mockLogger.info).toHaveBeenCalledTimes(1);

    const written = fileService.writeFile.mock.calls[0][1] as string;
    const parsed = matter(written);
    expect(parsed.data.tags).toEqual(["keep"]);
  });
});
