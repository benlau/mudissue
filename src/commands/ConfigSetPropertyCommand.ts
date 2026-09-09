import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { MudConfigFileStorage } from "../utils/storage/MudConfigFileStorage.ts";
import { FrontmatterValidator } from "../utils/validators/FrontmatterValidator.ts";
import {
  FrontmatterValueValidator,
  type FrontmatterValueType,
} from "../utils/validators/FrontmatterValueValidator.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ConfigSetPropertyCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";
import type { MudConfigNotFound } from "../types/errors.ts";

export type ConfigSetPropertyCommandSuccessResponse =
  SuccessResponse<ConfigSetPropertyCommandSuccessResult>;

export type ConfigSetPropertyCommandOptions = {
  type?: string;
  skipIfPresent?: boolean;
};

const msg = defineMessages({
  configSetPropertyDescribe: {
    id: "cli.config.setProperty.describe",
    defaultMessage: "Set a property in mud.conf",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionPropertyName: {
    id: "cli.common.option.propertyName",
    defaultMessage: "Property name to set",
  },
  optionValue: {
    id: "cli.common.option.value",
    defaultMessage: "Value to set",
  },
  optionType: {
    id: "cli.config.setProperty.option.type",
    defaultMessage: "Value type: string, boolean, or number",
  },
  optionSkipIfPresent: {
    id: "cli.config.setProperty.option.skipIfPresent",
    defaultMessage: "Do not modify the property if it is already present",
  },
  typeInvalid: {
    id: "cli.config.setProperty.error.typeInvalid",
    defaultMessage: 'Invalid type "{value}". Use string, boolean, or number.',
  },
  booleanInvalid: {
    id: "cli.config.setProperty.error.booleanInvalid",
    defaultMessage:
      'Invalid boolean value "{value}". Use yes/no/true/false/1/0.',
  },
  numberInvalid: {
    id: "cli.config.setProperty.error.numberInvalid",
    defaultMessage: 'Invalid number value "{value}".',
  },
  invalidProperty: {
    id: "cli.config.setProperty.error.invalidProperty",
    defaultMessage:
      "Invalid property key. Use only letters, numbers, underscores, and hyphens.",
  },
});

export class ConfigSetPropertyCommand extends Command {
  name = "config set-property";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new ConfigSetPropertyCommand();
    return yargs.command(
      "set-property <property> <value>",
      intl.formatMessage(msg.configSetPropertyDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("type", {
            type: "string",
            choices: ["string", "boolean", "number"] as const,
            describe: intl.formatMessage(msg.optionType),
            default: "string",
          })
          .option("skip-if-present", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionSkipIfPresent),
            default: false,
          })
          .positional("property", {
            describe: intl.formatMessage(msg.optionPropertyName),
            type: "string",
          })
          .positional("value", {
            describe: intl.formatMessage(msg.optionValue),
            type: "string",
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
          argv.property ?? "",
          argv.value ?? "",
          argv.project,
          {
            type: argv.type as FrontmatterValueType,
            skipIfPresent: argv["skip-if-present"] === true,
          },
        );
      },
    );
  }

  async command(
    property: string,
    value: string,
    project?: string,
    options: ConfigSetPropertyCommandOptions = {},
  ): Promise<ConfigSetPropertyCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    if (!FrontmatterValidator.isValidPropertyKey(property)) {
      return {
        status: "error",
        error: {
          code: "SET_CONFIG_INVALID_PROPERTY",
          message: intl.formatMessage(msg.invalidProperty),
          details: { property },
        },
      };
    }

    const valueType = options.type ?? "string";
    if (!FrontmatterValueValidator.isValidType(valueType)) {
      this.throwException(
        "COMMAND_INVALID_ARG",
        intl.formatMessage(msg.typeInvalid, { value: valueType }),
        { argument: "type", value: valueType },
      );
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

    if (options.skipIfPresent === true) {
      const existing = storage.getProperty(property);
      if (existing !== undefined) {
        return {
          status: "ok",
          result: {
            configFilePath,
            property,
            value: existing,
            skipped: true,
          },
        };
      }
    }

    const coerced = FrontmatterValueValidator.coerce(valueType, value);
    if (!coerced.ok) {
      let message: string;
      switch (coerced.code) {
        case "invalid_type":
          message = intl.formatMessage(msg.typeInvalid, { value: valueType });
          break;
        case "invalid_boolean":
          message = intl.formatMessage(msg.booleanInvalid, { value });
          break;
        case "invalid_number":
          message = intl.formatMessage(msg.numberInvalid, { value });
          break;
      }
      this.throwException("COMMAND_INVALID_ARG", message, {
        argument: coerced.argument,
        value: coerced.argument === "type" ? valueType : value,
      });
    }

    storage.setProperty(property, coerced.value);
    await storage.save();
    loggerService.info(
      `Set property "${property}" to "${coerced.value}" in ${configFilePath}`,
    );

    return {
      status: "ok",
      result: {
        configFilePath,
        property,
        value: coerced.value,
      },
    };
  }
}
