import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { EditorLauncher } from "../async/launchers/EditorLauncher.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ConfigEditCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";

const msg = defineMessages({
  configEditDescribe: {
    id: "cli.config.edit.describe",
    defaultMessage: "Edit mud.conf",
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
        builder.option("project", {
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
        await cmd.runCommand({ outputJson }, argv.project);
      },
    );
  }

  async command(
    project?: string,
  ): Promise<ConfigEditCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

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
