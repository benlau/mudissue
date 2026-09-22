import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../constants.ts";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { FrontmatterValidator } from "../utils/validators/FrontmatterValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptGetVarCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type ScriptGetVarCommandSuccessResponse =
  SuccessResponse<ScriptGetVarCommandSuccessResult>;

const msg = defineMessages({
  scriptGetVarDescribe: {
    id: "cli.script.getVar.describe",
    defaultMessage: "Get a script variable from the registry",
  },
  optionVarName: {
    id: "cli.script.option.varName",
    defaultMessage: "Variable name",
  },
  invalidVarName: {
    id: "cli.script.error.invalidVarName",
    defaultMessage:
      "Invalid variable name. Use only letters, numbers, underscores, and hyphens.",
  },
  varNotFound: {
    id: "cli.script.getVar.error.notFound",
    defaultMessage: 'Script variable "{name}" not found.',
  },
});

export class ScriptGetVarCommand extends Command {
  name = "script get-var";

  static register(yargs: Argv): Argv {
    const cmd = new ScriptGetVarCommand();
    return yargs.command(
      "get-var <name>",
      intl.formatMessage(msg.scriptGetVarDescribe),
      (builder) =>
        builder.positional("name", {
          describe: intl.formatMessage(msg.optionVarName),
          type: "string",
        }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson }, argv.name ?? "");
      },
    );
  }

  async command(
    name: string,
  ): Promise<ScriptGetVarCommandSuccessResponse | ErrorResponse> {
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

    const result = await RegistryService.getInstance().get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      name,
    );
    if (result === null) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_VAR_NOT_FOUND",
          message: intl.formatMessage(msg.varNotFound, { name }),
          details: { name },
        },
      };
    }

    LoggerService.getInstance().info(result.value);
    return {
      status: "ok",
      result: {
        name,
        value: result.value,
      },
    };
  }
}
