import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import packageJson from "../../package.json" with { type: "json" };
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  SuccessResponse,
  VersionCommandSuccessResult,
} from "../types/Response.ts";

export type VersionCommandSuccessResponse =
  SuccessResponse<VersionCommandSuccessResult>;

const msg = defineMessages({
  versionDescribe: {
    id: "cli.version.describe",
    defaultMessage: "Print the version of the remark library",
  },
});

export class VersionCommand extends Command {
  name = "version";

  static register(yargs: Argv): Argv {
    const cmd = new VersionCommand();
    return yargs.command(
      "version",
      intl.formatMessage(msg.versionDescribe),
      () => {},
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson });
      },
    );
  }

  async command(): Promise<VersionCommandSuccessResponse> {
    const version = packageJson.version as string;
    LoggerService.getInstance().info(version);
    return { status: "ok", result: { version } };
  }
}
