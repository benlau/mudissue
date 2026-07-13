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

export type IssueWorktreeMergeCommandSuccessResponse =
  SuccessResponse<IssueWorktreeGitCommandSuccessResult>;

export type IssueWorktreeMergeCommandOptions = {
  project?: string;
  force?: boolean;
  ffOnly?: boolean | null;
  outputJson?: boolean;
};

const msg = defineMessages({
  worktreeMergeDescribe: {
    id: "cli.worktree.merge.describe",
    defaultMessage: "cd [worktree of src] && git merge [branch:dst]",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionForce: {
    id: "cli.common.option.force",
    defaultMessage: "Run without asking for confirmation",
  },
  worktreeMergeFfOnly: {
    id: "cli.worktree.merge.option.ffOnly",
    defaultMessage:
      "Pass --ff-only to git merge; use --no-ff-only to disable when enabled by config",
  },
  worktreeMergeSrc: {
    id: "cli.worktree.merge.positional.src",
    defaultMessage:
      "'<src>' operand: `base` or issue selector (checkout where git runs)",
  },
  worktreeMergeDst: {
    id: "cli.worktree.merge.positional.dst",
    defaultMessage:
      "'<dst>' operand: `base` or issue selector (branch to merge into HEAD)",
  },
});

export class IssueWorktreeMergeCommand extends Command {
  name = "issue worktree merge";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeMergeCommand();
    return yargs.command(
      "merge <src> <dst>",
      intl.formatMessage(msg.worktreeMergeDescribe),
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
          .option("ff-only", {
            type: "boolean",
            describe: intl.formatMessage(msg.worktreeMergeFfOnly),
          })
          .positional("src", {
            describe: intl.formatMessage(msg.worktreeMergeSrc),
            type: "string",
            demandOption: true,
          })
          .positional("dst", {
            describe: intl.formatMessage(msg.worktreeMergeDst),
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
          ffOnly: argv["ff-only"] as boolean | undefined,
          outputJson,
        });
      },
    );
  }

  async command(
    srcOperand: string,
    dstOperand: string,
    options: IssueWorktreeMergeCommandOptions = {},
  ): Promise<IssueWorktreeMergeCommandSuccessResponse | ErrorResponse | void> {
    const result = await WorktreeHelper.executeIssueWorktreeGitOperation(
      "merge",
      srcOperand,
      dstOperand,
      {
        project: options.project,
        force: options.force,
        ffOnly: options.ffOnly,
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
