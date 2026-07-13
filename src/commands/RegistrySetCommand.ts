import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { URLFormatter } from "../foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  RegistrySetCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { RegistryCatalog } from "../services/RegistryService.ts";

export type RegistrySetCommandSuccessResponse =
  SuccessResponse<RegistrySetCommandSuccessResult>;

const msg = defineMessages({
  registrySetDescribe: {
    id: "cli.registry.set.describe",
    defaultMessage:
      "Set a registry key-value at a path or URL (url, key, value)",
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
  optionPathOrUrl: {
    id: "cli.common.option.pathOrUrl",
    defaultMessage: "Path or URL",
  },
});

export class RegistrySetCommand extends Command {
  name = "registry set";

  static register(yargs: Argv): Argv {
    const cmd = new RegistrySetCommand();
    return yargs.command(
      "set <url> <key> <value>",
      intl.formatMessage(msg.registrySetDescribe),
      (builder) =>
        builder
          .option("system", {
            type: "boolean",
            describe: intl.formatMessage(msg.registrySystem),
            default: false,
          })
          .positional("url", {
            describe: intl.formatMessage(msg.optionPathOrUrl),
            type: "string",
            demandOption: true,
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
          argv.url as string,
          argv.key as string,
          argv.value as string,
          { system: argv.system as boolean },
        );
      },
    );
  }

  async command(
    pathOrUrl: string,
    key: string,
    value: string,
    options?: { system?: boolean },
  ): Promise<RegistrySetCommandSuccessResponse | ErrorResponse> {
    const catalog: RegistryCatalog = options?.system ? "system" : "user";
    const cwd = ShellService.getInstance().cwd();
    const url = URLFormatter.normalizeRegistryUrl(pathOrUrl, cwd);
    await RegistryService.getInstance().set(key, value, url, catalog);
    LoggerService.getInstance().info(`Set registry ${key}=${value} at ${url}`);
    return {
      status: "ok",
      result: { url, key, value, catalog },
    };
  }
}
