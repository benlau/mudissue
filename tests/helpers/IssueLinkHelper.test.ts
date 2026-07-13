import { jest } from "@jest/globals";
import matter from "gray-matter";
import { IssueLinkHelper } from "../../src/helpers/IssueLinkHelper.ts";
import { resetGlobalConfigStore } from "../../src/store/GlobalConfigStore.ts";
import {
  resetIssueMetadataChangedPostHookStore,
  useIssueMetadataChangedPostHookStore,
} from "../../src/store/IssueMetadataChangedPostHookStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { SystemRuleKey } from "../../src/types/rules.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues", issue_file_pattern: "long" },
};

const srcIssue: IssueFolder = {
  issueId: "0001",
  folderName: "0001-blocker",
  path: "/repo/issues/0001-blocker",
};

const dstIssue: IssueFolder = {
  issueId: "0002",
  folderName: "0002-blocked",
  path: "/repo/issues/0002-blocked",
};

function issueContent(body = "Body\n"): string {
  return `---\ntitle: Test\n---\n\n${body}`;
}

describe("IssueLinkHelper", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];

  beforeEach(() => {
    resetGlobalConfigStore();
    resetIssueMetadataChangedPostHookStore();
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.findIssue.mockImplementation((selector: string) => {
      if (selector === "0001" || selector === srcIssue.folderName) {
        return Promise.resolve([srcIssue]);
      }
      if (selector === "0002" || selector === dstIssue.folderName) {
        return Promise.resolve([dstIssue]);
      }
      return Promise.resolve([]);
    });
  });

  it("links two issues bidirectionally with string fields on first link", async () => {
    const files = new Map<string, string>([
      [`${srcIssue.path}/issue.md`, issueContent()],
      [`${dstIssue.path}/issue.md`, issueContent()],
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

    const result = await IssueLinkHelper.link("0001", "blocking", "0002");

    expect(result.srcField).toBe("blocking");
    expect(result.dstField).toBe("blocked_by");
    expect(matter(files.get(`${srcIssue.path}/issue.md`)!).data.blocking).toBe(
      "[[0002-blocked]]",
    );
    expect(
      matter(files.get(`${dstIssue.path}/issue.md`)!).data.blocked_by,
    ).toBe("[[0001-blocker]]");
  });

  it("resolves reverse link type names on source issue", async () => {
    const files = new Map<string, string>([
      [`${srcIssue.path}/issue.md`, issueContent()],
      [`${dstIssue.path}/issue.md`, issueContent()],
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

    const result = await IssueLinkHelper.link(
      dstIssue.folderName,
      "blocked_by",
      srcIssue.folderName,
    );

    expect(result.srcField).toBe("blocked_by");
    expect(result.dstField).toBe("blocking");
  });

  it("notifies metadata post-hooks for both issues after linking", async () => {
    const files = new Map<string, string>([
      [`${srcIssue.path}/issue.md`, issueContent()],
      [`${dstIssue.path}/issue.md`, issueContent()],
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

    const hook = jest.fn();
    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, hook);

    await IssueLinkHelper.link("0001", "blocking", "0002");

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook).toHaveBeenNthCalledWith(
      1,
      srcIssue,
      expect.objectContaining({
        title: "Test",
        blocking: "[[0002-blocked]]",
      }),
      expect.objectContaining({
        title: "Test",
      }),
    );
    expect(hook).toHaveBeenNthCalledWith(
      2,
      dstIssue,
      expect.objectContaining({
        title: "Test",
        blocked_by: "[[0001-blocker]]",
      }),
      expect.objectContaining({
        title: "Test",
      }),
    );
  });

  it("throws LINK_SELF_REFERENCE when source and destination are the same issue", async () => {
    trackerRepoStore.findIssue.mockResolvedValue([srcIssue]);

    await expect(
      IssueLinkHelper.link("0001", "blocking", "0001"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "LINK_SELF_REFERENCE" },
    });
  });

  it("throws LINK_TYPE_UNKNOWN for unsupported link type", async () => {
    await expect(
      IssueLinkHelper.link("0001", "unsupported", "0002"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "LINK_TYPE_UNKNOWN" },
    });
  });

  it("throws ISSUE_MD_MISSING when an issue file is missing", async () => {
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    await expect(
      IssueLinkHelper.link("0001", "blocking", "0002"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MD_MISSING" },
    });
  });

  it("unlinks bidirectional linkage and collapses list to string", async () => {
    const files = new Map<string, string>([
      [
        `${srcIssue.path}/issue.md`,
        "---\nblocking:\n  - [[0002-blocked]]\n  - [[0003-third]]\n---\n\n",
      ],
      [
        `${dstIssue.path}/issue.md`,
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

    await IssueLinkHelper.unlink("0001", "blocking", "0002");

    expect(matter(files.get(`${srcIssue.path}/issue.md`)!).data.blocking).toBe(
      "0003-third",
    );
    expect(
      matter(files.get(`${dstIssue.path}/issue.md`)!).data.blocked_by,
    ).toBeUndefined();
  });

  it("unlinks orphan linkage from source when destination issue is not found", async () => {
    const files = new Map<string, string>([
      [
        `${srcIssue.path}/issue.md`,
        "---\nblocking:\n  - [[0002-blocked]]\n  - [[0003-third]]\n---\n\n",
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
    trackerRepoStore.findIssue.mockImplementation((selector: string) => {
      if (selector === "0001" || selector === srcIssue.folderName) {
        return Promise.resolve([srcIssue]);
      }
      return Promise.resolve([]);
    });

    const result = await IssueLinkHelper.unlink(
      "0001",
      "blocking",
      "0002-blocked",
    );

    expect(result).toEqual({
      srcIssue,
      dstIssue: null,
      dstNotFound: true,
      linkType: "blocking",
      srcField: "blocking",
      dstField: "blocked_by",
    });
    expect(matter(files.get(`${srcIssue.path}/issue.md`)!).data.blocking).toBe(
      "0003-third",
    );
    expect(
      fileService.writeFile.mock.calls.every(
        ([p]) => p === `${srcIssue.path}/issue.md`,
      ),
    ).toBe(true);
  });
});
