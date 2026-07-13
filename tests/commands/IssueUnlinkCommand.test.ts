import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueUnlinkCommand } from "../../src/commands/IssueUnlinkCommand.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import { resetGlobalConfigStore } from "../../src/store/GlobalConfigStore.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues", issue_file_pattern: "long" },
};

describe("IssueUnlinkCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let mockLogger: jest.Mocked<Pick<LoggerService, "info" | "warn">>;

  beforeEach(() => {
    resetGlobalConfigStore();
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    mockLogger = { info: jest.fn(), warn: jest.fn() };
    LoggerService.setInstance(mockLogger as unknown as LoggerService);
  });

  afterEach(() => {
    LoggerService.setInstance(null);
  });

  it("unlinks two issues and returns success result", async () => {
    trackerRepoStore.findIssue.mockImplementation((selector: string) => {
      if (selector === "0001") {
        return Promise.resolve([
          {
            issueId: "0001",
            folderName: "0001-blocker",
            path: "/repo/issues/0001-blocker",
          },
        ]);
      }
      if (selector === "0002") {
        return Promise.resolve([
          {
            issueId: "0002",
            folderName: "0002-blocked",
            path: "/repo/issues/0002-blocked",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const files = new Map<string, string>([
      [
        "/repo/issues/0001-blocker/issue.md",
        "---\nblocking: [[0002-blocked]]\n---\n\n",
      ],
      [
        "/repo/issues/0002-blocked/issue.md",
        "---\nblocked_by: [[0001-blocker]]\n---\n\n",
      ],
    ]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(files.has(p)),
    );
    fileService.readFile.mockImplementation((p: string) =>
      Promise.resolve(files.get(p) ?? ""),
    );
    fileService.writeFile.mockImplementation((p: string, content: string) => {
      files.set(p, content);
      return Promise.resolve();
    });

    const cmd = new IssueUnlinkCommand();
    const result = await cmd.command({
      src: "0001",
      linkType: "blocking",
      dst: "0002",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result.linkType).toBe("blocking");
      expect(result.result.dstIssueFolder).toBe(
        "/repo/issues/0002-blocked",
      );
    }
    expect(mockLogger.info).toHaveBeenCalled();
    expect(
      matter(files.get("/repo/issues/0001-blocker/issue.md")!).data.blocking,
    ).toBeUndefined();
    expect(
      matter(files.get("/repo/issues/0002-blocked/issue.md")!).data.blocked_by,
    ).toBeUndefined();
  });

  it("unlinks orphan link from source when destination is not found", async () => {
    trackerRepoStore.findIssue.mockImplementation((selector: string) => {
      if (selector === "0001") {
        return Promise.resolve([
          {
            issueId: "0001",
            folderName: "0001-blocker",
            path: "/repo/issues/0001-blocker",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const files = new Map<string, string>([
      [
        "/repo/issues/0001-blocker/issue.md",
        "---\nblocking: [[0002-blocked]]\n---\n\n",
      ],
    ]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(files.has(p)),
    );
    fileService.readFile.mockImplementation((p: string) =>
      Promise.resolve(files.get(p) ?? ""),
    );
    fileService.writeFile.mockImplementation((p: string, content: string) => {
      files.set(p, content);
      return Promise.resolve();
    });

    const cmd = new IssueUnlinkCommand();
    const result = await cmd.command({
      src: "0001",
      linkType: "blocking",
      dst: "0002-blocked",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result).toEqual({
        srcIssueFolder: "/repo/issues/0001-blocker",
        dstIssueFolder: null,
        linkType: "blocking",
        srcField: "blocking",
        dstField: "blocked_by",
        dstNotFound: true,
      });
    }
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(
      matter(files.get("/repo/issues/0001-blocker/issue.md")!).data.blocking,
    ).toBeUndefined();
  });
});
