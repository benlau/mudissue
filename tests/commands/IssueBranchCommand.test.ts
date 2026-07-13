import { jest } from "@jest/globals";
import * as path from "path";
import { IssueBranchCreateCommand } from "../../src/commands/IssueBranchCreateCommand.ts";
import { IssueBranchGetCommand } from "../../src/commands/IssueBranchGetCommand.ts";
import { IssueBranchRemoveCommand } from "../../src/commands/IssueBranchRemoveCommand.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (folderName: string, issueId?: string): IssueFolder => ({
  issueId: issueId ?? folderName,
  folderName,
  path: `/repo/issues/${folderName}`,
});

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueBranchCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    fileService.exists.mockResolvedValue(true);
    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockReturnValue({ status: 0 });
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    ShellService.setInstance(shellService as unknown as ShellService);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  it("gets the default branch name for an issue", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI0089-branch-create", "MI0089"),
    ]);

    const result = await new IssueBranchGetCommand().command("MI0089");

    expect(result?.status).toBe("ok");
    expect((result as { result: { branch: string } }).result.branch).toBe(
      "MI0089-branch-create",
    );
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("creates a branch using the configured branch template", async () => {
    const repoWithBranchTemplate: TrackerRepo = {
      ...mockRepo,
      config: {
        ...mockRepo.config,
        issue_branch_name_template: "pr/<%= issue_folder_name %>-dev",
      },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithBranchTemplate);
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI0089-branch-create", "MI0089"),
    ]);

    const result = await new IssueBranchCreateCommand().command("MI0089");

    expect(result?.status).toBe("ok");
    expect((result as { result: { branch: string } }).result.branch).toBe(
      "pr/MI0089-branch-create-dev",
    );
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["branch", "pr/MI0089-branch-create-dev"],
      { cwd: "/repo" },
    );
  });

  it("removes the branch with git branch -D", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI0089-branch-create", "MI0089"),
    ]);

    const result = await new IssueBranchRemoveCommand().command("MI0089");

    expect(result?.status).toBe("ok");
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["branch", "-D", "MI0089-branch-create"],
      { cwd: "/repo" },
    );
  });

  it("uses project routing when project is passed", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI0089-branch-create", "MI0089"),
    ]);

    await new IssueBranchGetCommand().command("MI0089", "proj-a");

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("MI0089", {
      project: "proj-a",
    });
  });
});
