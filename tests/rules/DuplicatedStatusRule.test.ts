import { jest } from "@jest/globals";
import matter from "gray-matter";
import { DuplicatedStatusRule } from "../../src/rules/DuplicatedStatusRule.ts";
import { useCurrentTrackerRepoStore } from "../../src/store/CurrentTrackerRepoStore.ts";
import { resetGlobalConfigStore } from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const duplicateIssue: IssueFolder = { issueId: "0002-dup", label: "0002", path: "/repo/issues/0002-dup",
 };

function issueMarkdown(frontmatter: Record<string, unknown>): string {
  return matter.stringify("Body\n", frontmatter);
}

describe("DuplicatedStatusRule", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let files: Map<string, string>;

  const enabledRepo: TrackerRepo = {
    name: "proj",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: {
      issue_path: "issues",
      issue_file_pattern: "long",
      status_list: ["open", "duplicated", "closed"],
      system_duplicated_status_rule: {
        enabled: true,
        duplicated_status: "duplicated",
        duplicated_link: "duplicated",
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
      findIssue: jest.fn().mockResolvedValue([duplicateIssue]),
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(enabledRepo),
      getTrackerRepoByProjectName: jest.fn().mockResolvedValue(enabledRepo),
    });
  });

  it("sets status to duplicated when a duplicated link is added", async () => {
    files.set(
      `${duplicateIssue.path}/issue.md`,
      issueMarkdown({ title: "Dup", status: "open" }),
    );

    await new DuplicatedStatusRule().onMetadataChanged(
      duplicateIssue,
      {
        title: "Dup",
        status: "open",
        duplicated: "[[0001-original]]",
      },
      {
        title: "Dup",
        status: "open",
      },
    );

    expect(matter(files.get(`${duplicateIssue.path}/issue.md`)!).data).toEqual({
      title: "Dup",
      status: "duplicated",
      updated_at: expect.any(String),
    });
  });

  it("skips setting duplicated when duplicated_status is not in status_list", async () => {
    const repoWithoutDuplicated: TrackerRepo = {
      ...enabledRepo,
      config: {
        ...enabledRepo.config,
        status_list: ["open", "closed"],
      },
    };
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest
        .fn()
        .mockResolvedValue(repoWithoutDuplicated),
      getCurrentTrackerRepo: jest
        .fn()
        .mockResolvedValue(repoWithoutDuplicated),
      getTrackerRepoByProjectName: jest
        .fn()
        .mockResolvedValue(repoWithoutDuplicated),
    });

    files.set(
      `${duplicateIssue.path}/issue.md`,
      issueMarkdown({ title: "Dup", status: "open" }),
    );

    await new DuplicatedStatusRule().onMetadataChanged(
      duplicateIssue,
      {
        title: "Dup",
        status: "open",
        duplicated: "[[0001-original]]",
      },
      {
        title: "Dup",
        status: "open",
      },
    );

    expect(matter(files.get(`${duplicateIssue.path}/issue.md`)!).data).toEqual({
      title: "Dup",
      status: "open",
    });
  });
});
