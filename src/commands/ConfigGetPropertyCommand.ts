import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { MudConfigFileStorage } from "../async/storage/MudConfigFileStorage.ts";
import { FrontmatterValidator } from "../async/validators/FrontmatterValidator.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ConfigGetPropertyCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";
import type { MudConfigNotFound } from "../types/errors.ts";

export type ConfigGetPropertyCommandSuccessResponse =
  SuccessResponse<ConfigGetPropertyCommandSuccessResult>;

function formatConfigValueForStdout(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

const msg = defineMessages({
  configGetPropertyDescribe: {
    id: "cli.config.getProperty.describe",
    defaultMessage: "Get a property from mud.conf",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionPropertyName: {
    id: "cli.common.option.propertyName",
    defaultMessage: "Property name to get",
  },
  invalidProperty: {
    id: "cli.config.getProperty.error.invalidProperty",
    defaultMessage:
      "Invalid property key. Use only letters, numbers, underscores, and hyphens.",
  },
});

export class ConfigGetPropertyCommand extends Command {
  name = "config get-property";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new ConfigGetPropertyCommand();
    return yargs.command(
      "get-property <property>",
      intl.formatMessage(msg.configGetPropertyDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("property", {
            describe: intl.formatMessage(msg.optionPropertyName),
            type: "string",
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson }, argv.property ?? "", argv.project);
      },
    );
  }

  async command(
    property: string,
    project?: string,
  ): Promise<ConfigGetPropertyCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    if (!FrontmatterValidator.isValidPropertyKey(property)) {
      return {
        status: "error",
        error: {
          code: "GET_CONFIG_INVALID_PROPERTY",
          message: intl.formatMessage(msg.invalidProperty),
          details: { property },
        },
      };
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

    const configFilePath = repo.configFilePath;
    const storage = new MudConfigFileStorage(configFilePath);
    await storage.load();

    const value = storage.getProperty(property);
    if (value === undefined) {
      return {
        status: "error",
        error: {
          code: "GET_CONFIG_PROPERTY_NOT_FOUND",
          message: `Property "${property}" not found in mud.conf.`,
          details: { property, configFilePath },
        },
      };
    }

    loggerService.info(formatConfigValueForStdout(value));
    return {
      status: "ok",
      result: {
        configFilePath,
        property,
        value,
      },
    };
  }
}
