import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeRebaseCommand } from "../../src/commands/IssueWorktreeRebaseCommand.ts";
import { GitService } from "../../src/services/GitService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";

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

describe("IssueWorktreeRebaseCommand", () => {
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    shellService = bundle.shellService;
    gitService = bundle.gitService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    bundle.fileService.exists.mockResolvedValue(true);
    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockReturnValue({ status: 0 });
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    gitService.getCurrentBranchLabel.mockResolvedValue("main");
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();

    ShellService.setInstance(shellService as unknown as ShellService);
    GitService.setInstance(gitService as unknown as GitService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    useGlobalConfigStore.setState({ globalConfig: {} });
  });

  afterEach(() => {
    ShellService.setInstance(null);
    GitService.setInstance(null);
    resetGlobalConfigStore();
  });

  it("runs git rebase with dst branch at src cwd", async () => {
    const srcFolder = "MI020-src";
    const dstFolder = "MI021-dst";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder)])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder)]);

    const cmd = new IssueWorktreeRebaseCommand();
    await cmd.command("MI020", "MI021", { force: true });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["rebase", dstFolder],
      {
        cwd: path.join(mockRepo.projectPath, ".claude/worktrees", srcFolder),
      },
    );
  });

  it("throws when git rebase exits non-zero", async () => {
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder("MI017-a")])
      .mockResolvedValueOnce([buildIssueFolder("MI017-b")]);
    shellService.runAndWait.mockReturnValue({ status: 1 });

    const cmd = new IssueWorktreeRebaseCommand();
    await expect(cmd.command("MI017", "017", { force: true })).rejects.toThrow(
      /git rebase failed/,
    );
  });
});
