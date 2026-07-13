import { jest } from "@jest/globals";
import { IssueSearcher } from "../../src/utils/search/IssueSearcher.ts";
import { SearchQueryParser } from "../../src/utils/search/SearchQueryParser.ts";
import type { ParsedSearchTerm } from "../../src/utils/search/types.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
  resetIssueSearchStore,
} from "../../src/store/IssueSearchStore.ts";
import {
  useCurrentTrackerRepoStore,
  resetCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { DEFAULT_PRIORITY_TABLE } from "../../src/types/priority.ts";
import {
  DEFAULT_RESOLVED_STATUS_LIST,
  DEFAULT_STATUS_LIST,
} from "../../src/types/status.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";

function buildIssue(id: string, updatedAt?: Date): IssueFolder {
  return {
    issueId: id,
    folderName: id,
    path: `/repo/issues/${id}`,
    ...(updatedAt != null ? { metadata: { updatedAt } } : {}),
  };
}

function issueSearchStore() {
  return IssueSearchStoreFactory.createOrGet(IssueSearchStoreKey.IssueTable);
}

function setTrackerRepoStoreMocks(repos: TrackerRepo[]): void {
  useCurrentTrackerRepoStore.setState({
    getTrackerRepoList: jest.fn().mockResolvedValue(repos),
    getStatusList: jest.fn().mockResolvedValue(DEFAULT_STATUS_LIST),
    getPriorityTable: jest.fn().mockResolvedValue(DEFAULT_PRIORITY_TABLE),
    getResolvedStatusList: jest
      .fn()
      .mockResolvedValue(DEFAULT_RESOLVED_STATUS_LIST),
  });
}

describe("IssueSearchStore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    resetIssueSearchStore();
    resetCurrentTrackerRepoStore();
  });

  test("searchFolders delegates to IssueSearcher with passed terms", async () => {
    const terms: ParsedSearchTerm[] = [
      { type: "status", value: "open", negated: false },
    ];
    const issues = [buildIssue("0001")];
    const expected = [buildIssue("0001", new Date("2026-01-01"))];

    const searchSpy = jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValue(expected);

    const result = await issueSearchStore()
      .getState()
      .searchFolders(issues, terms);

    expect(searchSpy).toHaveBeenCalledWith(issues, terms, undefined);
    expect(result).toEqual(expected);
  });

  test("searchAllFolders parses filter and sorts by updatedAt desc", async () => {
    const repoA: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };
    const repoB: TrackerRepo = {
      projectPath: "/repo-b",
      trackerPath: "/repo-b",
      name: "repo-b",
      config: { issue_path: "issues" },
    };
    const parsedTerms: ParsedSearchTerm[] = [
      { type: "status", value: "open", negated: false },
    ];

    const parseSpy = jest
      .spyOn(SearchQueryParser.prototype, "parse")
      .mockReturnValue(parsedTerms);
    const searchSpy = jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValueOnce([buildIssue("0001", new Date("2026-01-01"))])
      .mockResolvedValueOnce([buildIssue("0002", new Date("2026-02-01"))]);
    const listIssuesSpy = jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValueOnce([buildIssue("0001")])
      .mockResolvedValueOnce([buildIssue("0002")]);

    setTrackerRepoStoreMocks([repoA, repoB]);

    const result = await issueSearchStore()
      .getState()
      .searchAllFolders("status:open");

    expect(parseSpy).toHaveBeenCalledWith("status:open");
    expect(listIssuesSpy).toHaveBeenCalledTimes(2);
    expect(searchSpy).toHaveBeenNthCalledWith(
      1,
      [buildIssue("0001")],
      parsedTerms,
      { resolvedStatusList: DEFAULT_RESOLVED_STATUS_LIST },
    );
    expect(searchSpy).toHaveBeenNthCalledWith(
      2,
      [buildIssue("0002")],
      parsedTerms,
      { resolvedStatusList: DEFAULT_RESOLVED_STATUS_LIST },
    );
    expect(result.map((x) => x.issueId)).toEqual(["0002", "0001"]);
    expect(
      issueSearchStore()
        .getState()
        .savedSearchResults.map((x) => x.issueId),
    ).toEqual(["0002", "0001"]);
  });

  test("searchAllFolders sorts by configured issueId asc", async () => {
    const repo: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };

    jest
      .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
      .mockResolvedValue({
        field: "id",
        order: "asc",
      });
    jest
      .spyOn(RegistryService.getInstance(), "getPinnedIssueFolderNames")
      .mockResolvedValue([]);

    jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValueOnce([
        buildIssue("0002", new Date("2026-02-01")),
        buildIssue("0001", new Date("2026-01-01")),
      ]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue([buildIssue("0001"), buildIssue("0002")]);

    setTrackerRepoStoreMocks([repo]);

    const result = await issueSearchStore().getState().searchAllFolders(null);

    expect(result.map((x) => x.issueId)).toEqual(["0001", "0002"]);
  });

  test("searchAllFolders puts pinned issues first in registry order", async () => {
    const repo: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };

    jest
      .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
      .mockResolvedValue({
        field: "updated_at",
        order: "desc",
      });
    jest
      .spyOn(RegistryService.getInstance(), "getPinnedIssueFolderNames")
      .mockResolvedValue(["0001", "0003"]);

    jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValueOnce([
        buildIssue("0001", new Date("2026-01-01")),
        buildIssue("0002", new Date("2026-03-01")),
        buildIssue("0003", new Date("2026-02-01")),
      ]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue([
        buildIssue("0001"),
        buildIssue("0002"),
        buildIssue("0003"),
      ]);

    setTrackerRepoStoreMocks([repo]);

    const result = await issueSearchStore().getState().searchAllFolders(null);

    expect(result.map((x) => x.issueId)).toEqual(["0001", "0003", "0002"]);
  });

  test("searchAllFolders skips parser for empty filter", async () => {
    const repo: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };

    const parseSpy = jest.spyOn(SearchQueryParser.prototype, "parse");
    const searchSpy = jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValue([buildIssue("0001")]);
    const listIssuesSpy = jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue([buildIssue("0001")]);

    setTrackerRepoStoreMocks([repo]);

    await issueSearchStore().getState().searchAllFolders(null);

    expect(parseSpy).not.toHaveBeenCalled();
    expect(listIssuesSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith([buildIssue("0001")], [], {
      resolvedStatusList: DEFAULT_RESOLVED_STATUS_LIST,
    });
  });

  test("searchAllFolders promotes exact issue id match when matchedIdFirst is true", async () => {
    const repo: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };

    jest
      .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
      .mockResolvedValue({
        field: "id",
        order: "desc",
      });
    jest
      .spyOn(RegistryService.getInstance(), "getPinnedIssueFolderNames")
      .mockResolvedValue([]);

    jest
      .spyOn(SearchQueryParser.prototype, "parse")
      .mockReturnValue([{ type: "text", value: "67", negated: false }]);
    jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValueOnce([
        buildIssue("0167"),
        buildIssue("0067"),
        buildIssue("0001"),
      ]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue([
        buildIssue("0167"),
        buildIssue("0067"),
        buildIssue("0001"),
      ]);

    setTrackerRepoStoreMocks([repo]);

    const result = await issueSearchStore()
      .getState()
      .searchAllFolders("67", { matchedIdFirst: true });

    expect(result.map((x) => x.issueId)).toEqual(["0067", "0167", "0001"]);
  });

  test("searchAllFolders does not promote exact issue id match by default", async () => {
    const repo: TrackerRepo = {
      projectPath: "/repo-a",
      trackerPath: "/repo-a",
      name: "repo-a",
      config: { issue_path: "issues" },
    };

    jest
      .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
      .mockResolvedValue({
        field: "id",
        order: "desc",
      });
    jest
      .spyOn(RegistryService.getInstance(), "getPinnedIssueFolderNames")
      .mockResolvedValue([]);

    jest
      .spyOn(SearchQueryParser.prototype, "parse")
      .mockReturnValue([{ type: "text", value: "67", negated: false }]);
    jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValueOnce([
        buildIssue("0167"),
        buildIssue("0067"),
        buildIssue("0001"),
      ]);
    jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue([
        buildIssue("0167"),
        buildIssue("0067"),
        buildIssue("0001"),
      ]);

    setTrackerRepoStoreMocks([repo]);

    const result = await issueSearchStore().getState().searchAllFolders("67");

    expect(result.map((x) => x.issueId)).toEqual(["0167", "0067", "0001"]);
  });
});
