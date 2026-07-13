import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../utils/storage/IssueMarkdownFileStorage.ts";
import type {
  ErrorResponse,
  IssueUntagCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueUntagCommandArgs = {
  issueSelector: string;
  tags: string[];
  project?: string;
};

export type IssueUntagCommandSuccessResponse =
  SuccessResponse<IssueUntagCommandSuccessResult>;

const msg = defineMessages({
  issueUntagDescribe: {
    id: "cli.issue.untag.describe",
    defaultMessage:
      "List or remove tags from an issue's frontmatter tags field",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  issueUntagTags: {
    id: "cli.issue.untag.positional.tags",
    defaultMessage: "One or more tags to remove (omit to list current tags)",
  },
});

export class IssueUntagCommand extends Command {
  name = "issue untag";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueUntagCommand();
    return yargs.command(
      "untag <issue_selector> [tags...]",
      intl.formatMessage(msg.issueUntagDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          })
          .positional("tags", {
            describe: intl.formatMessage(msg.issueUntagTags),
            type: "string",
            array: true,
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
            issueSelector: argv.issue_selector as string,
            tags: (argv.tags ?? []) as string[],
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueUntagCommandArgs,
  ): Promise<IssueUntagCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    const tagNames = Array.isArray(input.tags) ? input.tags : [];
    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        input.issueSelector,
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

    if (tagNames.length > 0) {
      await folderStorage.removeTags(tagNames);
    }

    const storage = new IssueMarkdownFileStorage(issueFilePath);
    await storage.load();
    const tags = storage.getTags();
    for (const tag of tags) {
      loggerService.info(tag);
    }

    return {
      status: "ok",
      result: {
        issueFolder: issue.path,
        tags,
      },
    };
  }
}
