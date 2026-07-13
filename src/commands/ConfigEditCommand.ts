import type { Argv } from "yargs";
import * as os from "os";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { EditorLauncher } from "../utils/launchers/EditorLauncher.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ConfigEditCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";
import { GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILENAME } from "../constants.ts";

const msg = defineMessages({
  configEditDescribe: {
    id: "cli.config.edit.describe",
    defaultMessage: "Edit mud.conf or global config",
  },
  configGlobal: {
    id: "cli.config.option.global",
    defaultMessage: "Edit ~/.mudissue/global.conf",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
});

export type ConfigEditCommandSuccessResponse =
  SuccessResponse<ConfigEditCommandSuccessResult>;

export class ConfigEditCommand extends Command {
  name = "config edit";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new ConfigEditCommand();
    return yargs.command(
      "edit",
      intl.formatMessage(msg.configEditDescribe),
      (builder) =>
        builder
          .option("global", {
            type: "boolean",
            describe: intl.formatMessage(msg.configGlobal),
            default: false,
          })
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
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
          argv.global ?? false,
          argv.project,
        );
      },
    );
  }

  private getGlobalConfigPath(): string {
    return path.join(os.homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILENAME);
  }

  async command(
    global: boolean,
    project?: string,
  ): Promise<ConfigEditCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    if (global) {
      const configPath = this.getGlobalConfigPath();
      const dir = path.dirname(configPath);
      const exists = await fileService.exists(dir);
      if (!exists) {
        await fileService.mkdir(dir, { recursive: true });
      }
      if (!(await fileService.exists(configPath))) {
        await fileService.writeFile(configPath, "");
      }
      const repoForEditor = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
      const editor = await useCurrentTrackerRepoStore
        .getState()
        .getEditor(repoForEditor.config);
      if (editor === null) {
        return {
          status: "error",
          error: {
            code: "EDITOR_NOT_FOUND",
            message: "No editor found.",
          },
        };
      }
      const command = await new EditorLauncher().launch(editor, {
        filePath: configPath,
        isBlocked: false,
      });
      loggerService.info(command);
      return { status: "ok", result: { openedFile: configPath, command } };
    }

    let repo;
    if (project) {
      repo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    } else {
      repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
    }

    if (repo.configFilePath === undefined) {
      return {
        status: "error",
        error: {
          code: "EDIT_CONFIG_NO_REPO_CONFIG",
          message: "No repository config file path available.",
          details: { projectPath: repo.projectPath },
        },
      };
    }

    const editor = await useCurrentTrackerRepoStore
      .getState()
      .getEditor(repo.config);
    if (editor === null) {
      return {
        status: "error",
        error: {
          code: "EDITOR_NOT_FOUND",
          message: "No editor found.",
        },
      };
    }
    const command = await new EditorLauncher().launch(editor, {
      filePath: repo.configFilePath,
      isBlocked: false,
    });
    loggerService.info(command);
    return {
      status: "ok",
      result: { openedFile: repo.configFilePath, command },
    };
  }
}
