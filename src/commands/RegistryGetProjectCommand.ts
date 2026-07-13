import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type { ErrorResponse } from "../types/Response.ts";
import type { MudConfigNotFound } from "../types/errors.ts";
import {
  RegistryGetCommand,
  type RegistryGetCommandSuccessResponse,
} from "./RegistryGetCommand.ts";

const msg = defineMessages({
  registryGetProjectDescribe: {
    id: "cli.registry.getProject.describe",
    defaultMessage:
      "Get a registry value by key at the current project root (mud.conf)",
  },
  registrySystem: {
    id: "cli.registry.option.system",
    defaultMessage: "Use system catalog",
  },
  optionRegistryKey: {
    id: "cli.common.option.registryKey",
    defaultMessage: "Registry key",
  },
});

export class RegistryGetProjectCommand extends Command {
  name = "registry get-project";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new RegistryGetProjectCommand();
    return yargs.command(
      "get-project [key]",
      intl.formatMessage(msg.registryGetProjectDescribe),
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
            demandOption: false,
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson }, argv.key as string | undefined, {
          system: argv.system as boolean,
        });
      },
    );
  }

  async command(
    key: string | undefined,
    options?: { system?: boolean },
  ): Promise<RegistryGetCommandSuccessResponse | ErrorResponse> {
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
    return new RegistryGetCommand().command(found.root, key, {
      system: options?.system,
    });
  }
}
