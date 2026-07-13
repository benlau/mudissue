import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { GlobalConfigStorage } from "../utils/storage/GlobalConfigStorage.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ConfigLocateCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";
import type { MudConfigNotFound } from "../types/errors.ts";

const msg = defineMessages({
  configLocateDescribe: {
    id: "cli.config.locate.describe",
    defaultMessage: "Print the path of mud.conf or global config",
  },
  configGlobalLocate: {
    id: "cli.config.option.globalLocate",
    defaultMessage: "Path to ~/.mudissue/global.conf",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
});

export type ConfigLocateCommandSuccessResponse =
  SuccessResponse<ConfigLocateCommandSuccessResult>;

export class ConfigLocateCommand extends Command {
  name = "config locate";

  private readonly globalConfigStorage = new GlobalConfigStorage();

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new ConfigLocateCommand();
    return yargs.command(
      "locate",
      intl.formatMessage(msg.configLocateDescribe),
      (builder) =>
        builder
          .option("global", {
            type: "boolean",
            describe: intl.formatMessage(msg.configGlobalLocate),
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

  async command(
    global: boolean,
    project?: string,
  ): Promise<ConfigLocateCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    if (global) {
      const path = this.globalConfigStorage.getPath();
      loggerService.info(path);
      return { status: "ok", result: { path } };
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
      const details: MudConfigNotFound = { path: repo.projectPath };
      return {
        status: "error",
        error: {
          code: "MUD_CONFIG_NOT_FOUND",
          message: "No repository config file path available.",
          details,
        },
      };
    }

    loggerService.info(repo.configFilePath);
    return { status: "ok", result: { path: repo.configFilePath } };
  }
}
