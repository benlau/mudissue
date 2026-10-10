import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { IssueContentTextHelper } from "../helpers/IssueContentTextHelper.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import type {
  ErrorResponse,
  IssueAttachCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueFileAttachCommandArgs = {
  issueSelector: string;
  files: string[];
  project?: string;
  addLabel?: boolean;
  content?: string;
};

export type IssueFileAttachCommandSuccessResponse =
  SuccessResponse<IssueAttachCommandSuccessResult>;

function splitNameAndExt(filename: string): { name: string; ext: string } {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
}

const msg = defineMessages({
  issueFileAttachDescribe: {
    id: "cli.issue.file.attach.describe",
    defaultMessage:
      "Copy one or more files into an issue's files/ folder and record them in frontmatter",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  issueFileAttachFiles: {
    id: "cli.issue.file.attach.positional.files",
    defaultMessage:
      "File paths to attach (omit to type the attachment; the first line is the filename)",
  },
  optionAddLabel: {
    id: "cli.issue.file.attach.option.addLabel",
    defaultMessage:
      "Prefix the attached filename with the issue label (e.g. FN004-file.txt)",
  },
  optionContent: {
    id: "cli.issue.file.attach.option.content",
    defaultMessage:
      "Attachment text; the first non-empty line is the filename and the rest is the file body",
  },
  attachContentPrompt: {
    id: "cli.issue.file.attach.prompt.content",
    defaultMessage: "Type attachment content (Ctrl+D to confirm):",
  },
  errorIssueFileAttachUsage: {
    id: "cli.error.issue.file.attach.usage",
    defaultMessage:
      "Usage: mud issue file attach <issue_selector> [files...] [--project <name>] [--add-label] [--content <text>]",
  },
  errorIssueFileAttachJsonContent: {
    id: "cli.error.issue.file.attach.jsonContent",
    defaultMessage:
      "--json requires one or more file paths or --content when attaching inline text",
  },
});

function hasContentFlag(content: unknown): boolean {
  return typeof content === "string";
}

export class IssueFileAttachCommand extends Command {
  name = "issue file attach";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueFileAttachCommand();
    return yargs.command(
      "attach <issue_selector> [files...]",
      intl.formatMessage(msg.issueFileAttachDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("add-label", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionAddLabel),
            default: false,
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
          .positional("files", {
            describe: intl.formatMessage(msg.issueFileAttachFiles),
            type: "string",
            array: true,
          })
          .check((argv) => {
            const files = (argv.files ?? []) as unknown;
            const hasFiles = Array.isArray(files) && files.length > 0;
            const outputJson =
              argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
            if (outputJson && !hasFiles && !hasContentFlag(argv.content)) {
              throw new Error(
                intl.formatMessage(msg.errorIssueFileAttachJsonContent),
              );
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        const files = (argv.files ?? []) as string[];
        const hasFiles = files.length > 0;
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !hasFiles && !hasContentFlag(argv.content),
        });
        await cmd.runCommand(
          { outputJson },
          {
            issueSelector: argv.issue_selector as string,
            files,
            project: argv.project as string | undefined,
            addLabel: argv["add-label"] === true,
            content: argv.content as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueFileAttachCommandArgs,
  ): Promise<IssueFileAttachCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();

    const issueSelector = input.issueSelector;
    const filePaths = Array.isArray(input.files) ? input.files : [];
    if (!issueSelector) {
      this.throwException(
        "ATTACH_ARGS_INVALID",
        intl.formatMessage(msg.errorIssueFileAttachUsage),
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

    const attachmentsDir = await folderStorage.ensureAttachmentsDir();
    const attached: IssueAttachCommandSuccessResult["attached"] = [];
    const attachedNames: string[] = [];

    if (filePaths.length === 0) {
      const raw = await this.resolveInlineContent(input.content);
      const { title, body } = IssueContentTextHelper.splitIssueText(raw);
      const derived =
        IssueContentTextHelper.attachmentFilenameFromFirstLine(title);
      if (derived == null) {
        this.throwException(
          "ATTACH_CONTENT_EMPTY",
          "Attachment content was not provided.",
        );
      }
      const preferred =
        input.addLabel === true ? `${issue.label}-${derived}` : derived;
      const { filename, destPath } = await this.allocateAttachmentPath(
        attachmentsDir,
        preferred,
        fileService,
      );
      await fileService.writeFile(destPath, body ?? "", "utf-8");
      attached.push({ sourcePath: "", destPath, filename });
      attachedNames.push(filename);
    } else {
      for (const inputPath of filePaths) {
        const sourcePath = shellService.isAbsolute(inputPath)
          ? inputPath
          : path.resolve(shellService.cwd(), inputPath);

        if (!(await fileService.exists(sourcePath))) {
          this.throwException(
            "ATTACH_FILE_NOT_FOUND",
            `File not found: ${sourcePath}`,
            { path: sourcePath },
          );
        }

        const stat = await fileService.stat(sourcePath);
        if (!stat.isFile()) {
          this.throwException(
            "ATTACH_FILE_PATH_NOT_FILE",
            "A directory is not accepted.",
            { path: sourcePath },
          );
        }

        const base = path.basename(sourcePath);
        const preferred =
          input.addLabel === true ? `${issue.label}-${base}` : base;
        const { filename, destPath } = await this.allocateAttachmentPath(
          attachmentsDir,
          preferred,
          fileService,
        );

        await fileService.copyFile(sourcePath, destPath);
        attached.push({ sourcePath, destPath, filename });
        attachedNames.push(filename);
      }
    }

    await folderStorage.appendAttachments(attachedNames);

    for (const a of attached) {
      loggerService.info(a.destPath);
    }

    return {
      status: "ok",
      result: {
        issueFolder: {
          absPath: issue.path,
          folderName: issue.issueId,
        },
        attached,
      },
    };
  }

  private async resolveInlineContent(
    content: string | undefined,
  ): Promise<string> {
    if (content !== undefined) {
      return content;
    }
    const entered = await this.askUserTextContent(
      intl.formatMessage(msg.attachContentPrompt),
    );
    if (entered == null) {
      this.throwException(
        "ATTACH_CONTENT_EMPTY",
        "Attachment content was not provided.",
      );
    }
    return entered;
  }

  private async allocateAttachmentPath(
    attachmentsDir: string,
    preferred: string,
    fileService: FileService,
  ): Promise<{ filename: string; destPath: string }> {
    const { name, ext } = splitNameAndExt(preferred);
    let filename = preferred;
    let destPath = path.join(attachmentsDir, filename);
    let suffix = 1;
    while (await fileService.exists(destPath)) {
      filename = `${name}-${suffix}${ext}`;
      destPath = path.join(attachmentsDir, filename);
      suffix++;
    }
    return { filename, destPath };
  }
}
