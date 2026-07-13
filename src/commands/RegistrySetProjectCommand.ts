import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type { ErrorResponse } from "../types/Response.ts";
import type { MudConfigNotFound } from "../types/errors.ts";
import {
  RegistrySetCommand,
  type RegistrySetCommandSuccessResponse,
} from "./RegistrySetCommand.ts";

const msg = defineMessages({
  registrySetProjectDescribe: {
    id: "cli.registry.setProject.describe",
    defaultMessage:
      "Set a registry key-value at the current project root (mud.conf)",
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

export class RegistrySetProjectCommand extends Command {
  name = "registry set-project";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new RegistrySetProjectCommand();
    return yargs.command(
      "set-project <key> <value>",
      intl.formatMessage(msg.registrySetProjectDescribe),
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
    const found = await useCurrentTrackerRepoStore
      .getState()
      .findCurrentTrackerRepoByCWD();
    if (found === null) {
      const details: MudConfigNotFound = {
        path: ShellService.getInstance().cwd(),
      };
      return this.throwException(
        "MUD_CONFIG_NOT_FOUND",
        "mud.conf not found.",
        details,
      );
    }
    return new RegistrySetCommand().command(found.root, key, value, {
      system: options?.system,
    });
  }
}
