import { jest } from "@jest/globals";
import * as path from "path";
import {
  ScriptSelectIssueCommand,
} from "../../src/commands/ScriptSelectIssueCommand.tsx";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../../src/constants.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
  resetIssueSearchStore,
} from "../../src/store/IssueSearchStore.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (
  issueId: string,
  label?: string,
): IssueFolder => ({
  issueId,
  label: label ?? issueId,
  path: `/repo/issues/${issueId}`,
  metadata: { title: "Example title" },
});

const mockRepo: TrackerRepo = {
  name: "proj-a",
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

class TestScriptSelectIssueCommand extends ScriptSelectIssueCommand {
  pickCalls: Array<{
    issues: IssueFolder[];
    title: string;
    options?: { columns?: string };
  }> = [];

  constructor(private readonly pickedIssue: IssueFolder | null) {
    super();
  }

  protected override async askUserPickIssue(
    issues: IssueFolder[],
    title: string,
    options?: { columns?: string },
  ): Promise<IssueFolder | null> {
    this.pickCalls.push({ issues, title, options });
    return this.pickedIssue;
  }
}

describe("ScriptSelectIssueCommand", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];
  let dbService: DatabaseService;
  let registryService: RegistryService;

  beforeEach(() => {
    resetIssueSearchStore(IssueSearchStoreKey.Headless);
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService = bundle.issueFinderService;
    shellService = bundle.shellService;
    gitService = bundle.gitService;
    loggerService = bundle.loggerService;
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    jest.clearAllMocks();
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
    ]);
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
  });

  it("throws ISSUE_NOT_FOUND when selector matches no issues", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const command = new TestScriptSelectIssueCommand(null);

    await expect(command.command("9999")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("outputs folder name directly when selector matches one issue", async () => {
    const folder = buildIssueFolder("0215-script-writing");
    issueFinderService.find.mockResolvedValue([folder]);
    const command = new TestScriptSelectIssueCommand(null);

    const result = await command.command("0215");

    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "0215-script-writing" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("0215-script-writing");
    expect(command.pickCalls).toHaveLength(0);
  });

  it("writes folder name to a script variable when --set-var is set", async () => {
    const folder = buildIssueFolder("0215-script-writing");
    issueFinderService.find.mockResolvedValue([folder]);
    const command = new TestScriptSelectIssueCommand(null);

    const result = await command.command("0215", undefined, "selected_issue");

    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "0215-script-writing" },
    });
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "selected_issue",
    );
    expect(got).toEqual({
      url: MUDISSUE_SCRIPT_VARIABLES_URL,
      value: "0215-script-writing",
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("prompts when selector matches multiple issues and returns picked folder", async () => {
    const folders = [
      buildIssueFolder("0215-a", "0215"),
      buildIssueFolder("0215-b", "0215"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchFolders: jest.fn(async () => folders),
    });
    const command = new TestScriptSelectIssueCommand(folders[1]!);

    const result = await command.command("0215");

    expect(command.pickCalls).toEqual([
      { issues: folders, title: expect.any(String), options: undefined },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "0215-b" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("0215-b");
  });

  it("passes --columns into the picker and enriches candidates before pick", async () => {
    const bareFolders = [
      {
        issueId: "0215-a",
        label: "0215",
        path: "/repo/issues/0215-a",
      },
      {
        issueId: "0215-b",
        label: "0215",
        path: "/repo/issues/0215-b",
      },
    ] satisfies IssueFolder[];
    const enrichedFolders = [
      {
        ...bareFolders[0]!,
        metadata: {
          title: "A",
          status: "open",
          priority: "high",
          frontmatter: { assignee: "alice" },
        },
      },
      {
        ...bareFolders[1]!,
        metadata: {
          title: "B",
          status: "todo",
          priority: "low",
          frontmatter: { assignee: "bob" },
        },
      },
    ];
    issueFinderService.find.mockResolvedValue(bareFolders);
    const searchFolders = jest.fn(async () => enrichedFolders);
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchFolders,
    });
    const command = new TestScriptSelectIssueCommand(enrichedFolders[0]!);

    const result = await command.command(
      "0215",
      undefined,
      undefined,
      "assignee",
    );

    expect(searchFolders).toHaveBeenCalledWith(bareFolders, []);
    expect(command.pickCalls).toEqual([
      {
        issues: enrichedFolders,
        title: expect.any(String),
        options: { columns: "assignee" },
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "0215-a" },
    });
  });

  it("returns SCRIPT_SELECT_ISSUE_CANCELLED when user cancels the picker", async () => {
    const folders = [
      buildIssueFolder("0215-a", "0215"),
      buildIssueFolder("0215-b", "0215"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchFolders: jest.fn(async () => folders),
    });
    const command = new TestScriptSelectIssueCommand(null);

    const result = await command.command("0215");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_SELECT_ISSUE_CANCELLED" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("clears the script variable when cancelled with --set-var", async () => {
    await registryService.set(
      "selected_issue",
      "stale",
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
    );
    const folders = [
      buildIssueFolder("0215-a", "0215"),
      buildIssueFolder("0215-b", "0215"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchFolders: jest.fn(async () => folders),
    });
    const command = new TestScriptSelectIssueCommand(null);

    const result = await command.command("0215", undefined, "selected_issue");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_SELECT_ISSUE_CANCELLED" },
    });
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "selected_issue",
    );
    expect(got).toBeNull();
  });

  it("prompts from all issues when selector is omitted", async () => {
    const allIssues = Array.from({ length: 12 }, (_, index) =>
      buildIssueFolder(`issue-${index}`, `MI${index}`),
    );
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchAllFolders: jest.fn(async () => allIssues),
      searchFolders: jest.fn(async () => allIssues),
    });
    const command = new TestScriptSelectIssueCommand(allIssues[2]!);

    const result = await command.command(undefined);

    expect(command.pickCalls).toEqual([
      {
        issues: allIssues,
        title: expect.any(String),
        options: undefined,
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "issue-2" },
    });
  });

  it("throws ISSUE_NOT_FOUND when no issues exist and selector is omitted", async () => {
    IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    ).setState({
      searchAllFolders: jest.fn(async () => []),
    });
    const command = new TestScriptSelectIssueCommand(null);

    await expect(command.command(undefined)).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);
    const command = new TestScriptSelectIssueCommand(null);

    await expect(command.command("0215", "missing")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        details: { project: "missing" },
      },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  it("resolves current from the cwd mudissue worktree and outputs the folder name", async () => {
    const folder = buildIssueFolder("MI0100-mudissue", "MI0100");
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([folder]);
    const command = new TestScriptSelectIssueCommand(null);

    const result = await command.command("current");

    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue");
    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "MI0100-mudissue" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("MI0100-mudissue");
    expect(command.pickCalls).toHaveLength(0);
  });
});
