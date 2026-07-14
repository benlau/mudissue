import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueLinkHelper } from "../helpers/IssueLinkHelper.ts";
import type {
  ErrorResponse,
  IssueLinkCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueLinkCommandArgs = {
  src: string;
  linkType: string;
  dst: string;
  project?: string;
};

export type IssueLinkCommandSuccessResponse =
  SuccessResponse<IssueLinkCommandSuccessResult>;

const msg = defineMessages({
  issueLinkDescribe: {
    id: "cli.issue.link.describe",
    defaultMessage:
      "Link two issues with a bidirectional linkage in frontmatter",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionSrc: {
    id: "cli.issue.link.positional.src",
    defaultMessage: "Source issue ID, folder name, or suffix",
  },
  optionLinkType: {
    id: "cli.issue.link.positional.linkType",
    defaultMessage: "Linkage type (e.g. blocking, parent, related)",
  },
  optionDst: {
    id: "cli.issue.link.positional.dst",
    defaultMessage: "Destination issue ID, folder name, or suffix",
  },
});

export class IssueLinkCommand extends Command {
  name = "issue link";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueLinkCommand();
    return yargs.command(
      "link <src> <link_type> <dst>",
      intl.formatMessage(msg.issueLinkDescribe),
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
    input: IssueLinkCommandArgs,
  ): Promise<IssueLinkCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    const result = await IssueLinkHelper.link(
      input.src,
      input.linkType,
      input.dst,
      input.project,
    );

    const dstIssue = result.dstIssue!;
    loggerService.info(
      `Linked ${result.srcIssue.issueId} (${result.srcField}) → ${dstIssue.issueId} (${result.dstField})`,
    );

    return {
      status: "ok",
      result: {
        srcIssueFolder: result.srcIssue.path,
        dstIssueFolder: dstIssue.path,
        linkType: result.linkType,
        srcField: result.srcField,
        dstField: result.dstField,
      },
    };
  }
}
