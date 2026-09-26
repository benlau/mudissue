import { jest } from "@jest/globals";
import { IssueSearchCommand } from "../../src/commands/IssueSearchCommand.ts";
import { SearchQueryParser } from "../../src/async/search/SearchQueryParser.ts";
import type { ParsedSearchTerm } from "../../src/async/search/types.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
  type IssueSearchStoreState,
} from "../../src/store/IssueSearchStore.ts";
import { useCurrentTrackerRepoStore } from "../../src/store/CurrentTrackerRepoStore.ts";
import { TrackerRepoStorage } from "../../src/async/storage/TrackerRepoStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { DEFAULT_RESOLVED_STATUS_LIST } from "../../src/types/status.ts";
import {
  createMockSystemContext,
  type MockSystemContextBundle,
} from "../fixture/MockSystemContext.tsx";

const defaultSearchOptions = {
  resolvedStatusList: DEFAULT_RESOLVED_STATUS_LIST,
};
describe("IssueSearchCommand", () => {
  let bundle: MockSystemContextBundle;
  let searchFoldersMock: jest.Mock;

  beforeEach(() => {
    bundle = createMockSystemContext();
    searchFoldersMock = jest.fn();
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
      getState: () =>
        ({
          savedSearchResults: [],
          searchFolders: searchFoldersMock,
          searchAllFolders: jest.fn(),
        }) as IssueSearchStoreState,
      setState: jest.fn(),
      subscribe: jest.fn(),
      destroy: jest.fn(),
    } as IssueSearchStore);
    LoggerService.setInstance(
      bundle.loggerService as unknown as LoggerService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    LoggerService.setInstance(new LoggerService());
  });

  const buildIssueFolder = (
    issueId: string,
    metadata?: IssueFolder["metadata"],
  ): IssueFolder => ({
    issueId,
    label: issueId,
    path: `/repo/issues/${issueId}`,
    ...(metadata != null ? { metadata } : {}),
  });

  const stubRepo = {
    projectPath: "/repo",
    trackerPath: "/repo",
    name: "repo",
    config: { issue_path: "issues" },
  };

  function mockSortTables(): void {
    const storeState = useCurrentTrackerRepoStore.getState();
    jest.spyOn(useCurrentTrackerRepoStore, "getState").mockReturnValue({
      ...storeState,
      getTrackerRepoList: bundle.trackerRepoStore.getTrackerRepoList,
      getTrackerRepoByProjectName:
        bundle.trackerRepoStore.getTrackerRepoByProjectName,
      getStatusList: jest.fn().mockResolvedValue(["open", "closed"]),
      getPriorityTable: jest
        .fn()
        .mockResolvedValue({ priorities: ["urgent", "low"] }),
    });
  }

  test("searches issues and returns SuccessResponse with issues", async () => {
    const expectedTerms: ParsedSearchTerm[] = new SearchQueryParser().parse(
      "status:open",
    );
    const issues = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const results = [buildIssueFolder("0002")];
    const stubRepo = {
      projectPath: "/repo",
      trackerPath: "/repo",
      name: "repo",
      config: { issue_path: "issues" },
    };

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([stubRepo]);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue(issues);
    searchFoldersMock.mockResolvedValue(results);

    const command = new IssueSearchCommand();

    const result = await command.command(undefined, "status:open");

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(1);
    expect(result.result.projects[0].issues).toHaveLength(1);
    expect(result.result.projects[0].issues[0].issueId).toBe("0002");
    expect(searchFoldersMock).toHaveBeenCalledWith(
      issues,
      expectedTerms,
      defaultSearchOptions,
    );
    expect(bundle.loggerService.info).toHaveBeenCalled();
  });

  test("filters by full text search terms", async () => {
    const expectedTerms: ParsedSearchTerm[] = new SearchQueryParser().parse(
      "\"A B C\"",
    );
    const issues = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const results = [buildIssueFolder("0001")];
    const stubRepo = {
      projectPath: "/repo",
      trackerPath: "/repo",
      name: "repo",
      config: { issue_path: "issues" },
    };

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([stubRepo]);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue(issues);
    searchFoldersMock.mockResolvedValue(results);

    const command = new IssueSearchCommand();

    const result = await command.command(undefined, "A B C");

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(1);
    expect(result.result.projects[0].issues).toHaveLength(1);
    expect(result.result.projects[0].issues[0].issueId).toBe("0001");
    expect(searchFoldersMock).toHaveBeenCalledWith(
      issues,
      expectedTerms,
      defaultSearchOptions,
    );
    expect(bundle.loggerService.info).toHaveBeenCalled();
  });

  test("returns no projects when no matches", async () => {
    const stubRepo = {
      projectPath: "/repo",
      trackerPath: "/repo",
      name: "repo",
      config: { issue_path: "issues" },
    };
    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([stubRepo]);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue([]);
    searchFoldersMock.mockResolvedValue([]);

    const command = new IssueSearchCommand();

    const result = await command.command(undefined, "nosuch");

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(0);
    expect(bundle.loggerService.info).not.toHaveBeenCalled();
  });

  test("workspace with multiple repos returns projects array with name, projectPath, issues per project", async () => {
    const repoA = {
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      name: "proj-a",
      config: { issue_path: "issues" },
    };
    const repoB = {
      projectPath: "/ws/proj-b",
      trackerPath: "/ws/proj-b",
      name: "proj-b",
      config: { issue_path: "items" },
    };
    const issuesA = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const issuesB = [buildIssueFolder("0001")];
    const resultsA = [buildIssueFolder("0002")];
    const resultsB = [buildIssueFolder("0001")];

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([repoA, repoB]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValueOnce(issuesA)
      .mockResolvedValueOnce(issuesB);
    searchFoldersMock
      .mockResolvedValueOnce(resultsA)
      .mockResolvedValueOnce(resultsB);

    const command = new IssueSearchCommand();

    const result = await command.command(undefined, "query");

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(2);
    expect(result.result.projects[0]).toEqual({
      name: "proj-a",
      projectPath: "/ws/proj-a",
      issues: resultsA,
    });
    expect(result.result.projects[1]).toEqual({
      name: "proj-b",
      projectPath: "/ws/proj-b",
      issues: resultsB,
    });
    expect(searchFoldersMock).toHaveBeenCalledTimes(2);
    const expectedTerms = new SearchQueryParser().parse("query");
    expect(searchFoldersMock).toHaveBeenNthCalledWith(
      1,
      issuesA,
      expectedTerms,
      defaultSearchOptions,
    );
    expect(searchFoldersMock).toHaveBeenNthCalledWith(
      2,
      issuesB,
      expectedTerms,
      defaultSearchOptions,
    );
  });

  test("with project option searches only that project", async () => {
    const repoA = {
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      name: "proj-a",
      config: { issue_path: "issues" },
    };
    const issuesA = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const resultsA = [buildIssueFolder("0002")];

    (bundle.trackerRepoStore.getTrackerRepoByProjectName as jest.Mock).mockResolvedValue(repoA);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue(issuesA);
    searchFoldersMock.mockResolvedValue(resultsA);

    const command = new IssueSearchCommand();

    const result = await command.command("proj-a", "status:open");

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(1);
    expect(result.result.projects[0].name).toBe("proj-a");
    expect(result.result.projects[0].issues).toHaveLength(1);
    expect(result.result.projects[0].issues[0].issueId).toBe("0002");
    expect(bundle.trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith("proj-a");
    expect(bundle.trackerRepoStore.getTrackerRepoList).not.toHaveBeenCalled();
    expect(searchFoldersMock).toHaveBeenCalledTimes(1);
    expect(searchFoldersMock).toHaveBeenCalledWith(
      issuesA,
      new SearchQueryParser().parse("status:open"),
      defaultSearchOptions,
    );
  });

  test("with project option throws when project not found", async () => {
    (bundle.trackerRepoStore.getTrackerRepoByProjectName as jest.Mock).mockResolvedValue(null);

    const command = new IssueSearchCommand();

    await expect(command.command("nonexistent", "status:open")).rejects.toMatchObject({
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("Project not found"),
        details: { project: "nonexistent" },
      },
    });
    expect(searchFoldersMock).not.toHaveBeenCalled();
  });

  test("with --sort orders results by parsed sort keys", async () => {
    mockSortTables();
    const issues = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const results = [
      buildIssueFolder("0002", { title: "Beta" }),
      buildIssueFolder("0001", { title: "Alpha" }),
    ];

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([stubRepo]);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue(issues);
    searchFoldersMock.mockResolvedValue(results);

    const command = new IssueSearchCommand();

    const result = await command.command({
      queryParts: ["status:open"],
      sort: "+title",
    });

    expect(result.status).toBe("ok");
    expect(result.result.projects[0].issues.map((i) => i.issueId)).toEqual([
      "0001",
      "0002",
    ]);
  });

  test("with --sort orders by custom frontmatter field", async () => {
    mockSortTables();
    const issues = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const results = [
      buildIssueFolder("0002", {
        frontmatter: { assignee: "bob" },
      }),
      buildIssueFolder("0001", {
        frontmatter: { assignee: "alice" },
      }),
    ];

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([stubRepo]);
    jest.spyOn(TrackerRepoStorage.prototype, "listIssues").mockResolvedValue(issues);
    searchFoldersMock.mockResolvedValue(results);

    const command = new IssueSearchCommand();

    const result = await command.command({
      queryParts: ["status:open"],
      sort: "+assignee",
    });

    expect(result.status).toBe("ok");
    expect(result.result.projects[0].issues.map((i) => i.issueId)).toEqual([
      "0001",
      "0002",
    ]);
  });

  test("with --max caps total issues returned across projects", async () => {
    const repoA = {
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      name: "proj-a",
      config: { issue_path: "issues" },
    };
    const repoB = {
      projectPath: "/ws/proj-b",
      trackerPath: "/ws/proj-b",
      name: "proj-b",
      config: { issue_path: "items" },
    };
    const resultsA = [buildIssueFolder("0001"), buildIssueFolder("0002")];
    const resultsB = [buildIssueFolder("0003")];

    bundle.trackerRepoStore.getTrackerRepoList.mockResolvedValue([repoA, repoB]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    searchFoldersMock
      .mockResolvedValueOnce(resultsA)
      .mockResolvedValueOnce(resultsB);

    const command = new IssueSearchCommand();

    const result = await command.command({
      queryParts: ["query"],
      max: 2,
    });

    expect(result.status).toBe("ok");
    expect(result.result.projects).toHaveLength(1);
    expect(result.result.projects[0].issues).toHaveLength(2);
    expect(result.result.projects[0].issues.map((i) => i.issueId)).toEqual([
      "0001",
      "0002",
    ]);
  });

  test("throws COMMAND_INVALID_ARG for invalid --sort", async () => {
    const command = new IssueSearchCommand();

    await expect(
      command.command({ queryParts: ["q"], sort: "+" }),
    ).rejects.toMatchObject({
      error: {
        code: "COMMAND_INVALID_ARG",
        details: { argument: "sort", value: "+" },
      },
    });
  });

  test("throws COMMAND_INVALID_ARG for invalid --max", async () => {
    const command = new IssueSearchCommand();

    await expect(
      command.command({ queryParts: ["q"], max: 0 }),
    ).rejects.toMatchObject({
      error: {
        code: "COMMAND_INVALID_ARG",
        details: { argument: "max", value: "0" },
      },
    });
  });
});
