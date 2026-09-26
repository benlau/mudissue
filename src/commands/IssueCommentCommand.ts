import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { CommentAuthorHelper } from "../helpers/CommentAuthorHelper.ts";
import { DateFormatter } from "../foundation/formatter/DateFormatter.ts";
import type {
  ErrorResponse,
  IssueCommentCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueCommentCommandArgs = {
  issueSelector: string;
  author?: string;
  content?: string;
  project?: string;
};

export type IssueCommentCommandSuccessResponse =
  SuccessResponse<IssueCommentCommandSuccessResult>;

const msg = defineMessages({
  issueCommentDescribe: {
    id: "cli.issue.comment.describe",
    defaultMessage: "Append a comment to an issue markdown file",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  optionAuthor: {
    id: "cli.issue.comment.option.author",
    defaultMessage: "Comment author name",
  },
  optionContent: {
    id: "cli.issue.comment.option.content",
    defaultMessage: "Comment body text",
  },
  commentContentPrompt: {
    id: "cli.issue.comment.prompt.content",
    defaultMessage: "Type your comment (Ctrl+D to confirm):",
  },
  errorIssueCommentJsonContent: {
    id: "cli.error.issue.comment.jsonContent",
    defaultMessage: "--json requires --content",
  },
});

function hasContentFlag(content: unknown): boolean {
  return typeof content === "string" && content !== "";
}

export class IssueCommentCommand extends Command {
  name = "issue comment";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueCommentCommand();
    return yargs.command(
      "comment <issue_selector>",
      intl.formatMessage(msg.issueCommentDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("author", {
            type: "string",
            describe: intl.formatMessage(msg.optionAuthor),
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
                intl.formatMessage(msg.errorIssueCommentJsonContent),
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
            author: argv.author as string | undefined,
            content: argv.content as string | undefined,
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueCommentCommandArgs,
  ): Promise<IssueCommentCommandSuccessResponse | ErrorResponse> {
    const issueSelector = input.issueSelector;
    if (!issueSelector) {
      this.throwException(
        "COMMENT_ARGS_INVALID",
        "Usage: mud issue comment <issue_selector> [--author <name>] [--content <text>]",
      );
    }

    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        input.project,
      );

    const author = await CommentAuthorHelper.queryCommentAuthor(input.author);
    if (author === "") {
      this.throwException(
        "COMMENT_AUTHOR_NOT_FOUND",
        "Could not determine comment author. Use --author or set USERNAME in the system registry.",
      );
    }

    let content = input.content;
    if (content == null || content === "") {
      const entered = await this.askUserTextContent(
        intl.formatMessage(msg.commentContentPrompt),
      );
      if (entered == null) {
        this.throwException(
          "COMMENT_CONTENT_EMPTY",
          "Comment content was not provided.",
        );
      }
      content = entered;
    }

    if (content.trim() === "") {
      this.throwException(
        "COMMENT_CONTENT_EMPTY",
        "Comment content must not be empty.",
      );
    }

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
    await folderStorage.appendComment(author, content, at);
    await folderStorage.touchUpdatedAt(at);
    const timestamp = DateFormatter.format(at, "comment_timestamp");

    return {
      status: "ok",
      result: {
        issueFolder: issue.path,
        issueFilePath,
        author,
        timestamp,
      },
    };
  }
}
