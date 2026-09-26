import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";
import { GitFolderValidator } from "../async/validators/GitFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { WorktreeHelper } from "../helpers/WorktreeHelper.ts";
import type {
  ErrorResponse,
  IssueWorktreeListCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { GitService } from "../services/GitService.ts";
import { LoggerService } from "../services/LoggerService.ts";

export type IssueWorktreeListCommandSuccessResponse =
  SuccessResponse<IssueWorktreeListCommandSuccessResult>;

const msg = defineMessages({
  worktreeListDescribe: {
    id: "cli.worktree.list.describe",
    defaultMessage:
      "List absolute paths of issue worktrees linked to this repo",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
});

export class IssueWorktreeListCommand extends Command {
  name = "issue worktree list";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeListCommand();
    return yargs.command(
      "list",
      intl.formatMessage(msg.worktreeListDescribe),
      (builder) =>
        builder.option("project", {
          type: "string",
          describe: intl.formatMessage(msg.optionProject),
        }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson }, argv.project);
      },
    );
  }

  async command(
    project?: string,
  ): Promise<IssueWorktreeListCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();
    const gitService = GitService.getInstance();

    let repo;
    if (project) {
      repo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    } else {
      repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
    }

    const gitValidator = new GitFolderValidator();
    gitValidator.set(repo.projectPath);
    await gitValidator.validateDotGit();
    await gitValidator.validateGitBinary();

    const checkoutPaths = await gitService.listWorktree(repo.projectPath);
    const mudissuePaths = await WorktreeHelper.filterIssueWorktreeCheckoutPaths(
      repo,
      checkoutPaths,
    );

    for (const p of mudissuePaths) {
      loggerService.info(p);
    }

    return {
      status: "ok",
      result: { paths: mudissuePaths },
    };
  }
}
