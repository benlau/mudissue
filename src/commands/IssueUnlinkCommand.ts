import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueLinkHelper } from "../helpers/IssueLinkHelper.ts";
import type {
  ErrorResponse,
  IssueUnlinkCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueUnlinkCommandArgs = {
  src: string;
  linkType: string;
  dst: string;
  project?: string;
};

export type IssueUnlinkCommandSuccessResponse =
  SuccessResponse<IssueUnlinkCommandSuccessResult>;

const msg = defineMessages({
  issueUnlinkDescribe: {
    id: "cli.issue.unlink.describe",
    defaultMessage:
      "Remove a bidirectional linkage between two issues in frontmatter",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionSrc: {
    id: "cli.issue.unlink.positional.src",
    defaultMessage: "Source issue ID, folder name, or suffix",
  },
  optionLinkType: {
    id: "cli.issue.unlink.positional.linkType",
    defaultMessage: "Linkage type (e.g. blocking, parent, related)",
  },
  optionDst: {
    id: "cli.issue.unlink.positional.dst",
    defaultMessage: "Destination issue ID, folder name, or suffix",
  },
});

export class IssueUnlinkCommand extends Command {
  name = "issue unlink";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueUnlinkCommand();
    return yargs.command(
      "unlink <src> <link_type> <dst>",
      intl.formatMessage(msg.issueUnlinkDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("src", {
            describe: intl.formatMessage(msg.optionSrc),
            type: "string",
            demandOption: true,
          })
          .positional("link_type", {
            describe: intl.formatMessage(msg.optionLinkType),
            type: "string",
            demandOption: true,
          })
          .positional("dst", {
            describe: intl.formatMessage(msg.optionDst),
            type: "string",
            demandOption: true,
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand(
          { outputJson },
          {
            src: argv.src as string,
            linkType: argv.link_type as string,
            dst: argv.dst as string,
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueUnlinkCommandArgs,
  ): Promise<IssueUnlinkCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    const result = await IssueLinkHelper.unlink(
      input.src,
      input.linkType,
      input.dst,
      input.project,
    );

    if (result.dstNotFound) {
      loggerService.warn(
        `Unlinked ${result.srcIssue.folderName} (${result.srcField}) → ${input.dst} (destination issue not found)`,
      );
    } else {
      loggerService.info(
        `Unlinked ${result.srcIssue.folderName} (${result.srcField}) → ${result.dstIssue!.folderName} (${result.dstField})`,
      );
    }

    return {
      status: "ok",
      result: {
        srcIssueFolder: result.srcIssue.path,
        dstIssueFolder: result.dstIssue?.path ?? null,
        linkType: result.linkType,
        srcField: result.srcField,
        dstField: result.dstField,
        dstNotFound: result.dstNotFound || undefined,
      },
    };
  }
}
