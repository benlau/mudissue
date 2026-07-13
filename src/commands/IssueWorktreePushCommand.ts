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

export type IssueWorktreePushCommandSuccessResponse =
  SuccessResponse<IssueWorktreeGitCommandSuccessResult>;

export type IssueWorktreePushCommandOptions = {
  project?: string;
  force?: boolean;
  outputJson?: boolean;
};

const msg = defineMessages({
  worktreePushDescribe: {
    id: "cli.worktree.push.describe",
    defaultMessage: "cd [worktree of dst] && git merge [branch:src]",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionForce: {
    id: "cli.common.option.force",
    defaultMessage: "Run without asking for confirmation",
  },
  worktreePushSrc: {
    id: "cli.worktree.push.positional.src",
    defaultMessage:
      "'<src>' operand: `base` or issue selector (branch merged into dst)",
  },
  worktreePushDst: {
    id: "cli.worktree.push.positional.dst",
    defaultMessage:
      "'<dst>' operand: `base` or issue selector (checkout where git runs)",
  },
});

export class IssueWorktreePushCommand extends Command {
  name = "issue worktree push";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreePushCommand();
    return yargs.command(
      "push <src> <dst>",
      intl.formatMessage(msg.worktreePushDescribe),
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
            describe: intl.formatMessage(msg.worktreePushSrc),
            type: "string",
            demandOption: true,
          })
          .positional("dst", {
            describe: intl.formatMessage(msg.worktreePushDst),
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
    options: IssueWorktreePushCommandOptions = {},
  ): Promise<IssueWorktreePushCommandSuccessResponse | ErrorResponse | void> {
    const result = await WorktreeHelper.executeIssueWorktreeGitOperation(
      "push",
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
