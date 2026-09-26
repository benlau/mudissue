import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../constants.ts";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { FrontmatterValidator } from "../async/validators/FrontmatterValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptSetVarCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type ScriptSetVarCommandSuccessResponse =
  SuccessResponse<ScriptSetVarCommandSuccessResult>;

export type ScriptSetVarCommandOptions = {
  clear?: boolean;
};

const msg = defineMessages({
  scriptSetVarDescribe: {
    id: "cli.script.setVar.describe",
    defaultMessage: "Set or clear a script variable in the registry",
  },
  optionVarName: {
    id: "cli.script.option.varName",
    defaultMessage: "Variable name",
  },
  optionValue: {
    id: "cli.common.option.value",
    defaultMessage: "Value to set",
  },
  optionClear: {
    id: "cli.script.setVar.option.clear",
    defaultMessage: "Clear the variable (value is not needed)",
  },
  invalidVarName: {
    id: "cli.script.error.invalidVarName",
    defaultMessage:
      "Invalid variable name. Use only letters, numbers, underscores, and hyphens.",
  },
  valueRequired: {
    id: "cli.script.setVar.error.valueRequired",
    defaultMessage: "Value is required unless --clear is set.",
  },
  clearWithValue: {
    id: "cli.script.setVar.error.clearWithValue",
    defaultMessage: "Do not provide a value when using --clear.",
  },
  varNotFound: {
    id: "cli.script.setVar.error.notFound",
    defaultMessage: 'Script variable "{name}" not found.',
  },
});

export class ScriptSetVarCommand extends Command {
  name = "script set-var";

  static register(yargs: Argv): Argv {
    const cmd = new ScriptSetVarCommand();
    return yargs.command(
      "set-var <name> [value]",
      intl.formatMessage(msg.scriptSetVarDescribe),
      (builder) =>
        builder
          .option("clear", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionClear),
            default: false,
          })
          .positional("name", {
            describe: intl.formatMessage(msg.optionVarName),
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
        await cmd.runCommand({ outputJson }, argv.name ?? "", argv.value, {
          clear: argv.clear === true,
        });
      },
    );
  }

  async command(
    name: string,
    value?: string,
    options?: ScriptSetVarCommandOptions,
  ): Promise<ScriptSetVarCommandSuccessResponse | ErrorResponse> {
    if (!FrontmatterValidator.isValidPropertyKey(name)) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_VAR_INVALID_NAME",
          message: intl.formatMessage(msg.invalidVarName),
          details: { name },
        },
      };
    }

    const clear = options?.clear === true;
    const hasValue = value !== undefined;

    if (clear && hasValue) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_VAR_CLEAR_WITH_VALUE",
          message: intl.formatMessage(msg.clearWithValue),
          details: { name },
        },
      };
    }

    if (!clear && !hasValue) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_VAR_VALUE_REQUIRED",
          message: intl.formatMessage(msg.valueRequired),
          details: { name },
        },
      };
    }

    const registryService = RegistryService.getInstance();
    const loggerService = LoggerService.getInstance();

    if (clear) {
      const deleted = await registryService.delete(
        MUDISSUE_SCRIPT_VARIABLES_URL,
        "system",
        name,
      );
      if (!deleted) {
        return {
          status: "error",
          error: {
            code: "SCRIPT_VAR_NOT_FOUND",
            message: intl.formatMessage(msg.varNotFound, { name }),
            details: { name },
          },
        };
      }
      loggerService.info(`Cleared script variable ${name}`);
      return {
        status: "ok",
        result: {
          name,
          cleared: true,
        },
      };
    }

    await registryService.set(
      name,
      value!,
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
    );
    loggerService.info(`Set script variable ${name}=${value}`);
    return {
      status: "ok",
      result: {
        name,
        value,
        cleared: false,
      },
    };
  }
}
