import { jest } from "@jest/globals";
import { ScriptUniqCommand } from "../../src/commands/ScriptUniqCommand.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const buildIssueFolder = (issueId: string, label?: string): IssueFolder =>
  buildIssueFolderFixture(issueId, {
    label: label ?? issueId,
    path: `/repo/issues/${issueId}`,
    title: "Example title",
  });

describe("ScriptUniqCommand", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService = bundle.issueFinderService;
    loggerService = bundle.loggerService;
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    jest.clearAllMocks();
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
  });

  it("throws ISSUE_NOT_FOUND when selector matches no issues", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const command = new ScriptUniqCommand();

    await expect(command.command("9999")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("throws ISSUE_MULTI_MATCHED when selector matches multiple issues", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0215-a", "0215"),
      buildIssueFolder("0215-b", "0215"),
    ]);
    const command = new ScriptUniqCommand();

    await expect(command.command("0215")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("outputs folder name when selector matches one issue", async () => {
    const folder = buildIssueFolder("0215-script-writing");
    issueFinderService.find.mockResolvedValue([folder]);
    const command = new ScriptUniqCommand();

    const result = await command.command("0215");

    expect(result).toEqual({
      status: "ok",
      result: { issueFolderName: "0215-script-writing" },
    });
    expect(loggerService.info).toHaveBeenCalled();
  });

  it("throws PROJECT_NOT_FOUND when project does not exist", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);
    const command = new ScriptUniqCommand();

    await expect(
      command.command("0215-script-writing", "missing"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PROJECT_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });
});
