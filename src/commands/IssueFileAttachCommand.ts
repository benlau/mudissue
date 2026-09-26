import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
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
    defaultMessage: "One or more file paths to attach",
  },
  optionAddLabel: {
    id: "cli.issue.file.attach.option.addLabel",
    defaultMessage:
      "Prefix the attached filename with the issue label (e.g. FN004-file.txt)",
  },
  errorIssueFileAttachUsage: {
    id: "cli.error.issue.file.attach.usage",
    defaultMessage:
      "Usage: mud issue file attach <issue_selector> <file_path..> [--project <name>] [--add-label]",
  },
});

export class IssueFileAttachCommand extends Command {
  name = "issue file attach";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueFileAttachCommand();
    return yargs.command(
      "attach <issue_selector> <files...>",
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
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          })
          .positional("files", {
            describe: intl.formatMessage(msg.issueFileAttachFiles),
            type: "string",
            array: true,
            demandOption: true,
          })
          .check((argv) => {
            const files = (argv.files ?? []) as unknown;
            if (!Array.isArray(files) || files.length < 1) {
              throw new Error(
                intl.formatMessage(msg.errorIssueFileAttachUsage),
              );
            }
            return true;
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
            files: (argv.files ?? []) as string[],
            project: argv.project as string | undefined,
            addLabel: argv["add-label"] === true,
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
    if (!issueSelector || filePaths.length < 1) {
      this.throwException(
        "ATTACH_ARGS_INVALID",
        "Usage: mud issue file attach <issue_selector> <file_path..> [--project <name>] [--add-label]",
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
      const prefixedBase =
        input.addLabel === true ? `${issue.label}-${base}` : base;
      const { name, ext } = splitNameAndExt(prefixedBase);
      let filename = prefixedBase;
      let destPath = path.join(attachmentsDir, filename);
      let suffix = 1;
      while (await fileService.exists(destPath)) {
        filename = `${name}-${suffix}${ext}`;
        destPath = path.join(attachmentsDir, filename);
        suffix++;
      }

      await fileService.copyFile(sourcePath, destPath);
      attached.push({ sourcePath, destPath, filename });
      attachedNames.push(filename);
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
}
