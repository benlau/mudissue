import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import type {
  ErrorResponse,
  IssueWorktreeGitCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { WorktreeHelper } from "../helpers/WorktreeHelper.ts";

export type IssueWorktreeRebaseCommandSuccessResponse =
  SuccessResponse<IssueWorktreeGitCommandSuccessResult>;

export type IssueWorktreeRebaseCommandOptions = {
  project?: string;
  force?: boolean;
  outputJson?: boolean;
};

const msg = defineMessages({
  worktreeRebaseDescribe: {
    id: "cli.worktree.rebase.describe",
    defaultMessage: "cd [worktree of src] && git rebase [branch:dst]",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionForce: {
    id: "cli.common.option.force",
    defaultMessage: "Run without asking for confirmation",
  },
  worktreeRebaseSrc: {
    id: "cli.worktree.rebase.positional.src",
    defaultMessage:
      "'<src>' operand: `base` or issue selector (checkout where git runs)",
  },
  worktreeRebaseDst: {
    id: "cli.worktree.rebase.positional.dst",
    defaultMessage:
      "'<dst>' operand: `base` or issue selector (upstream branch for rebase)",
  },
});

export class IssueWorktreeRebaseCommand extends Command {
  name = "issue worktree rebase";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeRebaseCommand();
    return yargs.command(
      "rebase <src> <dst>",
      intl.formatMessage(msg.worktreeRebaseDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("force", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionForce),
            default: false,
          })
          .positional("src", {
            describe: intl.formatMessage(msg.worktreeRebaseSrc),
            type: "string",
            demandOption: true,
          })
          .positional("dst", {
            describe: intl.formatMessage(msg.worktreeRebaseDst),
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
        await cmd.runCommand({ outputJson }, argv.src ?? "", argv.dst ?? "", {
          project: argv.project as string | undefined,
          force: argv.force as boolean | undefined,
          outputJson,
        });
      },
    );
  }

  async command(
    srcOperand: string,
    dstOperand: string,
    options: IssueWorktreeRebaseCommandOptions = {},
  ): Promise<IssueWorktreeRebaseCommandSuccessResponse | ErrorResponse | void> {
    const result = await WorktreeHelper.executeIssueWorktreeGitOperation(
      "rebase",
      srcOperand,
      dstOperand,
      {
        project: options.project,
        force: options.force,
        askConfirmation: (m) => this.askUserConfirmation(m),
      },
    );

    if (result.status === "cancelled") {
      return;
    }

    return {
      status: "ok",
      result: {
        cwd: result.cwd,
        command: result.command,
      },
    };
  }
}
