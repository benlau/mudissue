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
  RegistryGetCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { RegistryCatalog } from "../services/RegistryService.ts";

export type RegistryGetCommandSuccessResponse =
  SuccessResponse<RegistryGetCommandSuccessResult>;

const msg = defineMessages({
  registryGetDescribe: {
    id: "cli.registry.get.describe",
    defaultMessage: "Get a registry value by key",
  },
  registrySystem: {
    id: "cli.registry.option.system",
    defaultMessage: "Use system catalog",
  },
  optionRegistryKey: {
    id: "cli.common.option.registryKey",
    defaultMessage: "Registry key",
  },
  optionPathOrUrl: {
    id: "cli.common.option.pathOrUrl",
    defaultMessage: "Path or URL",
  },
});

export class RegistryGetCommand extends Command {
  name = "registry get";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new RegistryGetCommand();
    return yargs.command(
      "get <url> [key]",
      intl.formatMessage(msg.registryGetDescribe),
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
            demandOption: false,
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
          argv.key as string | undefined,
          {
            system: argv.system as boolean,
          },
        );
      },
    );
  }

  async command(
    pathOrUrl: string,
    key: string | undefined,
    options?: { system?: boolean },
  ): Promise<RegistryGetCommandSuccessResponse | ErrorResponse> {
    const catalog: RegistryCatalog = options?.system ? "system" : "user";
    const cwd = ShellService.getInstance().cwd();
    const url = URLFormatter.normalizeRegistryUrl(pathOrUrl, cwd);
    const registryService = RegistryService.getInstance();

    if (key !== undefined && key.trim() !== "") {
      const result = await registryService.get(url, catalog, key);

      if (result === null) {
        return this.throwException(
          "REGISTRY_KEY_NOT_FOUND",
          "Registry key not found.",
          {
            key,
          },
        );
      }
      LoggerService.getInstance().info(result.value);
      return {
        status: "ok",
        result: {
          url: result.url,
          records: { [key]: result.value },
        },
      };
    }

    const records = await registryService.getRecords(url, catalog);

    LoggerService.getInstance().info(
      Object.entries(records)
        .map(([entryKey, entryValue]) => `${entryKey}=${entryValue}`)
        .join("\n"),
    );
    return {
      status: "ok",
      result: { url, records },
    };
  }
}
