import { jest } from "@jest/globals";
import matter from "gray-matter";
import { BlockedStatusRule } from "../../src/rules/BlockedStatusRule.ts";
import { useCurrentTrackerRepoStore } from "../../src/store/CurrentTrackerRepoStore.ts";
import { resetGlobalConfigStore } from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const blockerIssue: IssueFolder = { issueId: "0001-blocker", label: "0001", path: "/repo/issues/0001-blocker",
 };

const blockedIssue: IssueFolder = { issueId: "0002-blocked", label: "0002", path: "/repo/issues/0002-blocked",
 };

const otherBlockerIssue: IssueFolder = { issueId: "0003-other-blocker", label: "0003", path: "/repo/issues/0003-other-blocker",
 };

function issueMarkdown(frontmatter: Record<string, unknown>): string {
  return matter.stringify("Body\n", frontmatter);
}

describe("BlockedStatusRule", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let files: Map<string, string>;

  const enabledRepo: TrackerRepo = {
    name: "proj",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: {
      issue_path: "issues",
      issue_file_pattern: "long",
      status_list: ["open", "blocked", "closed", "canceled"],
      system_blocked_status_rule: {
        enabled: true,
        blocked_status: "blocked",
        unblocked_status: "open",
        blocking_link: "blocking",
        blocked_by_link: "blocked_by",
      },
    },
  };

  beforeEach(() => {
    resetGlobalConfigStore();
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    files = new Map();

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
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest
        .fn()
        .mockResolvedValue(enabledRepo),
      findIssue: jest.fn().mockImplementation((selector: string) => {
        const all = [blockerIssue, blockedIssue, otherBlockerIssue];
        return Promise.resolve(
          all.filter(
            (issue) =>
              issue.issueId === selector ||
              issue.issueId === selector ||
              issue.issueId.startsWith(selector),
          ),
        );
      }),
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(enabledRepo),
      getTrackerRepoByProjectName: jest.fn().mockResolvedValue(enabledRepo),
    });
  });

  it("sets status to blocked when a blocked_by link is added and blocked is in status_list", async () => {
    files.set(
      `${blockedIssue.path}/issue.md`,
      issueMarkdown({ title: "Blocked", status: "open" }),
    );

    await new BlockedStatusRule().onMetadataChanged(
      blockedIssue,
      {
        title: "Blocked",
        status: "open",
        blocked_by: "[[0001-blocker]]",
      },
      {
        title: "Blocked",
        status: "open",
      },
    );

    expect(matter(files.get(`${blockedIssue.path}/issue.md`)!).data).toEqual({
      title: "Blocked",
      status: "blocked",
      updated_at: expect.any(String),
    });
  });

  it("skips setting blocked when blocked_status is not in status_list", async () => {
    const repoWithoutBlocked: TrackerRepo = {
      ...enabledRepo,
      config: {
        ...enabledRepo.config,
        status_list: ["open", "closed"],
      },
    };
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest
        .fn()
        .mockResolvedValue(repoWithoutBlocked),
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repoWithoutBlocked),
      getTrackerRepoByProjectName: jest
        .fn()
        .mockResolvedValue(repoWithoutBlocked),
    });

    files.set(
      `${blockedIssue.path}/issue.md`,
      issueMarkdown({ title: "Blocked", status: "open" }),
    );

    await new BlockedStatusRule().onMetadataChanged(
      blockedIssue,
      {
        title: "Blocked",
        status: "open",
        blocked_by: "[[0001-blocker]]",
      },
      {
        title: "Blocked",
        status: "open",
      },
    );

    expect(matter(files.get(`${blockedIssue.path}/issue.md`)!).data).toEqual({
      title: "Blocked",
      status: "open",
    });
  });

  it("sets the blocked issue to open when closing the last remaining blocker", async () => {
    files.set(
      `${blockerIssue.path}/issue.md`,
      issueMarkdown({
        title: "Blocker",
        status: "closed",
        blocking: "[[0002-blocked]]",
      }),
    );
    files.set(
      `${blockedIssue.path}/issue.md`,
      issueMarkdown({
        title: "Blocked",
        status: "blocked",
        blocked_by: "[[0001-blocker]]",
      }),
    );

    await new BlockedStatusRule().onMetadataChanged(
      blockerIssue,
      {
        title: "Blocker",
        status: "closed",
        blocking: "[[0002-blocked]]",
      },
      {
        title: "Blocker",
        status: "in_progress",
        blocking: "[[0002-blocked]]",
      },
    );

    expect(matter(files.get(`${blockedIssue.path}/issue.md`)!).data).toEqual({
      title: "Blocked",
      status: "open",
      blocked_by: "[[0001-blocker]]",
      updated_at: expect.any(String),
    });
  });

  it("leaves the blocked issue blocked when another blocker is still open", async () => {
    files.set(
      `${blockerIssue.path}/issue.md`,
      issueMarkdown({
        title: "Blocker",
        status: "closed",
        blocking: "[[0002-blocked]]",
      }),
    );
    files.set(
      `${otherBlockerIssue.path}/issue.md`,
      issueMarkdown({
        title: "Other blocker",
        status: "open",
        blocking: "[[0002-blocked]]",
      }),
    );
    files.set(
      `${blockedIssue.path}/issue.md`,
      issueMarkdown({
        title: "Blocked",
        status: "blocked",
        blocked_by: ["[[0001-blocker]]", "[[0003-other-blocker]]"],
      }),
    );

    await new BlockedStatusRule().onMetadataChanged(
      blockerIssue,
      {
        title: "Blocker",
        status: "closed",
        blocking: "[[0002-blocked]]",
      },
      {
        title: "Blocker",
        status: "open",
        blocking: "[[0002-blocked]]",
      },
    );

    expect(matter(files.get(`${blockedIssue.path}/issue.md`)!).data).toEqual({
      title: "Blocked",
      status: "blocked",
      blocked_by: ["[[0001-blocker]]", "[[0003-other-blocker]]"],
    });
  });

  it("does nothing when the rule is disabled", async () => {
    const disabledRepo: TrackerRepo = {
      ...enabledRepo,
      config: {
        ...enabledRepo.config,
        system_blocked_status_rule: {
          enabled: false,
          blocked_status: "blocked",
          unblocked_status: "open",
          blocking_link: "blocking",
          blocked_by_link: "blocked_by",
        },
      },
    };
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(disabledRepo),
    });

    files.set(
      `${blockedIssue.path}/issue.md`,
      issueMarkdown({ title: "Blocked", status: "open" }),
    );

    await new BlockedStatusRule().onMetadataChanged(
      blockedIssue,
      {
        title: "Blocked",
        status: "open",
        blocked_by: "[[0001-blocker]]",
      },
      {
        title: "Blocked",
        status: "open",
      },
    );

    expect(matter(files.get(`${blockedIssue.path}/issue.md`)!).data).toEqual({
      title: "Blocked",
      status: "open",
    });
  });
});
