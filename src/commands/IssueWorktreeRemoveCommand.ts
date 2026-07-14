import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { GitFolderValidator } from "../utils/validators/GitFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueWorktreeRemoveCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";

export type IssueWorktreeRemoveCommandSuccessResponse =
  SuccessResponse<IssueWorktreeRemoveCommandSuccessResult>;

export type IssueWorktreeRemoveCommandOptions = {
  project?: string;
  force?: boolean;
  deleteBranch?: boolean;
  outputJson?: boolean;
};

const msg = defineMessages({
  worktreeRemoveDescribe: {
    id: "cli.worktree.remove.describe",
    defaultMessage: "Remove the git worktree for the selected issue",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  worktreeRemoveForce: {
    id: "cli.worktree.remove.option.force",
    defaultMessage: "Remove without asking for confirmation",
  },
  worktreeRemoveDeleteBranch: {
    id: "cli.worktree.remove.option.deleteBranch",
    defaultMessage: "Also delete the issue branch after removing the worktree",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
});

export class IssueWorktreeRemoveCommand extends Command {
  name = "issue worktree remove";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeRemoveCommand();
    return yargs.command(
      "remove <issue_selector>",
      intl.formatMessage(msg.worktreeRemoveDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("force", {
            type: "boolean",
            describe: intl.formatMessage(msg.worktreeRemoveForce),
            default: false,
          })
          .option("delete-branch", {
            type: "boolean",
            describe: intl.formatMessage(msg.worktreeRemoveDeleteBranch),
            default: false,
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !(argv.force === true),
        });
        await cmd.runCommand({ outputJson }, argv.issue_selector ?? "", {
          project: argv.project as string | undefined,
          force: argv.force as boolean | undefined,
          deleteBranch: argv["delete-branch"] as boolean | undefined,
          outputJson,
        });
      },
    );
  }

  async command(
    issueSelector: string,
    options: IssueWorktreeRemoveCommandOptions = {},
  ): Promise<IssueWorktreeRemoveCommandSuccessResponse | ErrorResponse | void> {
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        options.project,
      );

    const gitValidator = new GitFolderValidator();
    gitValidator.set(repo.projectPath);
    await gitValidator.validateDotGit();
    await gitValidator.validateGitBinary();

    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(issue.issueId);
    const branch = options.deleteBranch
      ? await useCurrentTrackerRepoStore
          .getState()
          .getIssueBranchName(repo, issue)
      : undefined;

    if (!options.force) {
      const confirmed = await this.askUserConfirmation(
        `Remove worktree ${worktreePath}${branch ? ` and branch ${branch}` : ""}?`,
      );
      if (!confirmed) {
        loggerService.info("Worktree removal cancelled");
        return;
      }
    }

    const { status } = shellService.runAndWait(
      "git",
      ["worktree", "remove", worktreePath],
      { cwd: repo.projectPath },
    );
    if (status !== 0) {
      throw new Error(
        `git worktree remove failed${status != null ? ` (exit code ${status})` : ""}`,
      );
    }

    if (branch) {
      const branchRemoveResult = shellService.runAndWait(
        "git",
        ["branch", "-D", branch],
        { cwd: repo.projectPath },
      );
      if (branchRemoveResult.status !== 0) {
        throw new Error(
          `git branch -D failed${
            branchRemoveResult.status != null
              ? ` (exit code ${branchRemoveResult.status})`
              : ""
          }`,
        );
      }
    }

    loggerService.info(worktreePath);
    return {
      status: "ok",
      result: { path: worktreePath, ...(branch && { branch }) },
    };
  }
}
