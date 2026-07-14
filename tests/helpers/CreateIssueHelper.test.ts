import { jest } from "@jest/globals";
import { CreateIssueHelper } from "../../src/helpers/CreateIssueHelper.ts";
import { NextIssueIdHelper } from "../../src/helpers/NextIssueIdHelper.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import type { IssueSearchStoreState } from "../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../src/store/IssueSearchStore.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import { IssueResource } from "../../src/utils/resources/IssueResource.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../fixture/navigationStack.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

function buildIssue(
  issueId: string,
  overrides?: Parameters<typeof buildIssueFolder>[1],
): IssueFolder {
  return buildIssueFolder(issueId, {
    title: `${issueId} title`,
    status: "open",
    ...overrides,
  });
}

function viewerPageStack(issue: IssueFolder, project?: string) {
  return viewerNavigationStack(issue, project);
}

function currentViewerIssue(): IssueFolder | null {
  const page = useAppStore.getState().getCurrentPage();
  return page.name === "ISSUE_VIEWER" ? page.args.issue : null;
}

function mockIssueSearchStore(
  state: IssueSearchStoreState,
): IssueSearchStore {
  return {
    getState: () => state,
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  } as IssueSearchStore;
}

describe("CreateIssueHelper", () => {
  const helper = new CreateIssueHelper();

  beforeEach(() => {
    resetAppStore();
    resetGlobalConfigStore();
    resetCurrentTrackerRepoStore();
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([]),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetGlobalConfigStore();
    resetCurrentTrackerRepoStore();
  });

  it("createIssue passes the first status_list entry as default status", async () => {
    const repo = {
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repo),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0001");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");

    const createdFolder = buildIssueFolder("0001-my-issue", {
      label: "0001",
      path: "/repo/issues/0001-my-issue",
      title: "My issue",
    });
    const createSpy = jest
      .spyOn(IssueResource.prototype, "create")
      .mockResolvedValue(createdFolder);

    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([createdFolder]),
      }),
    );

    await helper.createIssue("My issue");

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "0001-my-issue" }),
      "/repo/issues/0001-my-issue/issue.md",
      "My issue",
      undefined,
      "pending",
      "medium",
      "long",
      undefined,
    );
    expect(currentViewerIssue()).toEqual(createdFolder);
    expect(useAppStore.getState().navigationStack).toEqual(viewerPageStack(createdFolder));
  });

  it("createIssue forwards optional body content to IssueResource.create", async () => {
    const repo = {
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repo),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0001");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");

    const createdFolder = buildIssueFolder("0001-my-issue", {
      label: "0001",
      path: "/repo/issues/0001-my-issue",
      title: "My issue",
    });
    const createSpy = jest
      .spyOn(IssueResource.prototype, "create")
      .mockResolvedValue(createdFolder);

    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([createdFolder]),
      }),
    );

    await helper.createIssue("My issue", undefined, "Body text");

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "0001-my-issue" }),
      "/repo/issues/0001-my-issue/issue.md",
      "My issue",
      undefined,
      "pending",
      "medium",
      "long",
      "Body text",
    );
  });

  it("createSubissue links parent and child issues then opens the child", async () => {
    const parentIssue = buildIssue("0001");
    const repo = {
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repo),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0002");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0002-child-issue/issue.md");

    const createdFolder = buildIssueFolder("0002-child-issue", {
      label: "0002",
      path: "/repo/issues/0002-child-issue",
      title: "Child issue",
    });
    const createSpy = jest
      .spyOn(IssueResource.prototype, "create")
      .mockResolvedValue(createdFolder);
    const appendSubissueSpy = jest
      .spyOn(IssueFolderStorage.prototype, "appendSubissue")
      .mockResolvedValue(undefined);
    const setParentSpy = jest
      .spyOn(IssueFolderStorage.prototype, "setParent")
      .mockResolvedValue(undefined);

    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest
          .fn()
          .mockResolvedValue([parentIssue, createdFolder]),
      }),
    );

    await helper.createSubissue("Child issue", parentIssue);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "0002-child-issue" }),
      "/repo/issues/0002-child-issue/issue.md",
      "Child issue",
      undefined,
      "pending",
      "medium",
      "long",
      undefined,
    );
    expect(appendSubissueSpy).toHaveBeenCalledWith(
      createdFolder.issueId,
      "long",
    );
    expect(setParentSpy).toHaveBeenCalledWith(parentIssue.issueId, "long");
    expect(createSpy.mock.invocationCallOrder[0]).toBeLessThan(
      appendSubissueSpy.mock.invocationCallOrder[0]!,
    );
    expect(currentViewerIssue()).toEqual(createdFolder);
    expect(useAppStore.getState().navigationStack).toEqual(
      viewerPageStack(createdFolder),
    );
  });

  it("createIssue preserves search filter and opens the new issue when search is active", async () => {
    const repo = {
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repo),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0002");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0002-my-issue/issue.md");

    const createdFolder = buildIssueFolder("0002-my-issue", {
      label: "0002",
      path: "/repo/issues/0002-my-issue",
      title: "My issue",
    });
    jest
      .spyOn(IssueResource.prototype, "create")
      .mockResolvedValue(createdFolder);

    const filteredIssues = [buildIssue("MI0001")];
    const fullList = [filteredIssues[0]!, createdFolder, buildIssue("MI0003")];
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn(async (filter: string | null) => {
          if (filter != null && filter.trim() !== "") {
            return filteredIssues;
          }
          return fullList;
        }),
      }),
    );

    useAppStore.setState({
      filter: "status:open",
      mainIssueLists: filteredIssues,
      selectedIssueId: filteredIssues[0]!.issueId,
      searchRestoreIssueId: "MI0003-sample",
    });

    await helper.createIssue("My issue");

    expect(useAppStore.getState().filter).toBe("status:open");
    expect(currentViewerIssue()).toEqual(createdFolder);
    expect(useAppStore.getState().navigationStack).toEqual(
      viewerPageStack(createdFolder),
    );
    expect(useAppStore.getState().getSelectedIssues()).toEqual([createdFolder]);
  });

  it("createSubissue preserves search filter and opens the child when search is active", async () => {
    const parentIssue = buildIssue("0001");
    const repo = {
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(repo),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0002");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0002-child-issue/issue.md");

    const createdFolder = buildIssueFolder("0002-child-issue", {
      label: "0002",
      path: "/repo/issues/0002-child-issue",
      title: "Child issue",
    });
    jest
      .spyOn(IssueResource.prototype, "create")
      .mockResolvedValue(createdFolder);
    const appendSubissueSpy = jest
      .spyOn(IssueFolderStorage.prototype, "appendSubissue")
      .mockResolvedValue(undefined);
    const setParentSpy = jest
      .spyOn(IssueFolderStorage.prototype, "setParent")
      .mockResolvedValue(undefined);

    const filteredIssues = [buildIssue("MI0001")];
    const fullList = [parentIssue, filteredIssues[0]!, createdFolder];
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn(async (filter: string | null) => {
          if (filter != null && filter.trim() !== "") {
            return filteredIssues;
          }
          return fullList;
        }),
      }),
    );

    useAppStore.setState({
      filter: "status:open",
      mainIssueLists: filteredIssues,
      selectedIssueId: filteredIssues[0]!.issueId,
      searchRestoreIssueId: "MI0003-sample",
    });

    await helper.createSubissue("Child issue", parentIssue);

    expect(appendSubissueSpy).toHaveBeenCalledWith(
      createdFolder.issueId,
      "long",
    );
    expect(setParentSpy).toHaveBeenCalledWith(parentIssue.issueId, "long");
    expect(useAppStore.getState().filter).toBe("status:open");
    expect(currentViewerIssue()).toEqual(createdFolder);
    expect(useAppStore.getState().navigationStack).toEqual(
      viewerPageStack(createdFolder),
    );
  });
});
