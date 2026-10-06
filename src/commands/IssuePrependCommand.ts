import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import {
  IssueBodyContentHelper,
  type IssueBodyMutateErrorCodes,
} from "../helpers/IssueBodyContentHelper.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import type {
  ErrorResponse,
  IssuePrependCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssuePrependCommandArgs = {
  issueSelector: string;
  content?: string;
  fromFile?: string;
  fromEnvVar?: string;
  project?: string;
};

export type IssuePrependCommandSuccessResponse =
  SuccessResponse<IssuePrependCommandSuccessResult>;

const msg = defineMessages({
  issuePrependDescribe: {
    id: "cli.issue.prepend.describe",
    defaultMessage: "Prepend content to an issue markdown body",
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
    id: "cli.issue.prepend.option.content",
    defaultMessage: "Text to prepend to the issue body",
  },
  optionFromFile: {
    id: "cli.issue.prepend.option.fromFile",
    defaultMessage: "Issue body text from file",
  },
  optionFromEnvVar: {
    id: "cli.issue.prepend.option.fromEnvVar",
    defaultMessage: "Issue body text from environment variable",
  },
  prependContentPrompt: {
    id: "cli.issue.prepend.prompt.content",
    defaultMessage: "Type content to prepend (Ctrl+D to confirm):",
  },
  errorIssuePrependJsonContent: {
    id: "cli.error.issue.prepend.jsonContent",
    defaultMessage: "--json requires --content, --from-file, or --from-env-var",
  },
});

const prependBodyErrorCodes: IssueBodyMutateErrorCodes = {
  fileNotFound: "PREPEND_FILE_NOT_FOUND",
  pathNotFile: "PREPEND_PATH_NOT_FILE",
  fileBinary: "PREPEND_FILE_BINARY",
  envVarMissing: "PREPEND_ENV_VAR_MISSING",
  contentEmpty: "PREPEND_CONTENT_EMPTY",
};

export class IssuePrependCommand extends Command {
  name = "issue prepend";
  private bodyContentHelper = new IssueBodyContentHelper();

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssuePrependCommand();
    return yargs.command(
      "prepend <issue_selector>",
      intl.formatMessage(msg.issuePrependDescribe),
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
          .option("from-file", {
            type: "string",
            describe: intl.formatMessage(msg.optionFromFile),
          })
          .option("from-env-var", {
            type: "string",
            describe: intl.formatMessage(msg.optionFromEnvVar),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          })
          .check((argv) => {
            IssueBodyContentHelper.assertAtMostOneBodySource(argv);
            const outputJson =
              argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
            if (
              outputJson &&
              !IssueBodyContentHelper.hasHeadlessBodySource(argv)
            ) {
              throw new Error(
                intl.formatMessage(msg.errorIssuePrependJsonContent),
              );
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        const hasBody = IssueBodyContentHelper.hasHeadlessBodySource(argv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !hasBody,
        });
        await cmd.runCommand(
          { outputJson },
          {
            issueSelector: argv.issue_selector as string,
            content: argv.content as string | undefined,
            fromFile: argv.fromFile as string | undefined,
            fromEnvVar: argv.fromEnvVar as string | undefined,
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssuePrependCommandArgs,
  ): Promise<IssuePrependCommandSuccessResponse | ErrorResponse> {
    const issueSelector = input.issueSelector;
    if (!issueSelector) {
      this.throwException(
        "PREPEND_ARGS_INVALID",
        "Usage: mud issue prepend <issue_selector> [--content <text>] [--from-file <path>] [--from-env-var <name>]",
      );
    }

    const content = await this.bodyContentHelper.resolveMutateBodyContent(
      {
        content: input.content,
        fromFile: input.fromFile,
        fromEnvVar: input.fromEnvVar,
      },
      {
        errorCodes: prependBodyErrorCodes,
        prompt: intl.formatMessage(msg.prependContentPrompt),
        contentNotProvidedMessage: "Prepend content was not provided.",
        throwException: (code, message) => this.throwException(code, message),
        askUserTextContent: (prompt) => this.askUserTextContent(prompt),
      },
    );

    if (content.trim() === "") {
      this.throwException(
        "PREPEND_CONTENT_EMPTY",
        "Prepend content must not be empty.",
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
    await folderStorage.prependContent(content);
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
