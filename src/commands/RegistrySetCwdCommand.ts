import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type { ErrorResponse } from "../types/Response.ts";
import {
  RegistrySetCommand,
  type RegistrySetCommandSuccessResponse,
} from "./RegistrySetCommand.ts";

const msg = defineMessages({
  registrySetCwdDescribe: {
    id: "cli.registry.setCwd.describe",
    defaultMessage: "Set a registry key-value at the current working directory",
  },
  registrySystem: {
    id: "cli.registry.option.system",
    defaultMessage: "Use system catalog",
  },
  optionRegistryKey: {
    id: "cli.common.option.registryKey",
    defaultMessage: "Registry key",
  },
  optionValue: {
    id: "cli.common.option.value",
    defaultMessage: "Value to set",
  },
});

export class RegistrySetCwdCommand extends Command {
  name = "registry set-cwd";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new RegistrySetCwdCommand();
    return yargs.command(
      "set-cwd <key> <value>",
      intl.formatMessage(msg.registrySetCwdDescribe),
      (builder) =>
        builder
          .option("system", {
            type: "boolean",
            describe: intl.formatMessage(msg.registrySystem),
            default: false,
          })
          .positional("key", {
            describe: intl.formatMessage(msg.optionRegistryKey),
            type: "string",
            demandOption: true,
          })
          .positional("value", {
            describe: intl.formatMessage(msg.optionValue),
            type: "string",
            demandOption: true,
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
          argv.key as string,
          argv.value as string,
          { system: argv.system as boolean },
        );
      },
    );
  }

  async command(
    key: string,
    value: string,
    options?: { system?: boolean },
  ): Promise<RegistrySetCommandSuccessResponse | ErrorResponse> {
    const cwd = ShellService.getInstance().cwd();
    return new RegistrySetCommand().command(cwd, key, value, {
      system: options?.system,
    });
  }
}
