import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import type {
  ErrorResponse,
  IssueAppendCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueAppendCommandArgs = {
  issueSelector: string;
  content?: string;
  project?: string;
};

export type IssueAppendCommandSuccessResponse =
  SuccessResponse<IssueAppendCommandSuccessResult>;

const msg = defineMessages({
  issueAppendDescribe: {
    id: "cli.issue.append.describe",
    defaultMessage: "Append content to an issue markdown body",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  optionContent: {
    id: "cli.issue.append.option.content",
    defaultMessage: "Text to append to the issue body",
  },
  appendContentPrompt: {
    id: "cli.issue.append.prompt.content",
    defaultMessage: "Type content to append (Ctrl+D to confirm):",
  },
  errorIssueAppendJsonContent: {
    id: "cli.error.issue.append.jsonContent",
    defaultMessage: "--json requires --content",
  },
});

function hasContentFlag(content: unknown): boolean {
  return typeof content === "string" && content !== "";
}

export class IssueAppendCommand extends Command {
  name = "issue append";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueAppendCommand();
    return yargs.command(
      "append <issue_selector>",
      intl.formatMessage(msg.issueAppendDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("content", {
            type: "string",
            describe: intl.formatMessage(msg.optionContent),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          })
          .check((argv) => {
            const outputJson =
              argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
            if (outputJson && !hasContentFlag(argv.content)) {
              throw new Error(
                intl.formatMessage(msg.errorIssueAppendJsonContent),
              );
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        const hasContent = hasContentFlag(argv.content);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !hasContent,
        });
        await cmd.runCommand(
          { outputJson },
          {
            issueSelector: argv.issue_selector as string,
            content: argv.content as string | undefined,
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueAppendCommandArgs,
  ): Promise<IssueAppendCommandSuccessResponse | ErrorResponse> {
    const issueSelector = input.issueSelector;
    if (!issueSelector) {
      this.throwException(
        "APPEND_ARGS_INVALID",
        "Usage: mud issue append <issue_selector> [--content <text>]",
      );
    }

    let content = input.content;
    if (content == null || content === "") {
      const entered = await this.askUserTextContent(
        intl.formatMessage(msg.appendContentPrompt),
      );
      if (entered == null) {
        this.throwException(
          "APPEND_CONTENT_EMPTY",
          "Append content was not provided.",
        );
      }
      content = entered;
    }

    if (content.trim() === "") {
      this.throwException(
        "APPEND_CONTENT_EMPTY",
        "Append content must not be empty.",
      );
    }

    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        input.project,
      );

    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();
    if (issueFilePath === undefined) {
      this.throwException(
        "ISSUE_MD_MISSING",
        `No issue file found in ${issue.path}.`,
        { path: issue.path },
      );
    }

    const at = new Date();
    await folderStorage.appendContent(content);
    await folderStorage.touchUpdatedAt(at);

    return {
      status: "ok",
      result: {
        issueId: issue.issueId,
        issueFolderName: issue.issueId,
        issueFilePath,
      },
    };
  }
}
