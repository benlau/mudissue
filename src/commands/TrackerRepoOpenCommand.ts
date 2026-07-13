import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  TrackerRepoOpenCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type TrackerRepoOpenCommandSuccessResponse =
  SuccessResponse<TrackerRepoOpenCommandSuccessResult>;

const msg = defineMessages({
  trackerOpenDescribe: {
    id: "cli.tracker.open.describe",
    defaultMessage: "Open the current issue tracker folder",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
});

export class TrackerRepoOpenCommand extends Command {
  name = "tracker open";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new TrackerRepoOpenCommand();
    return yargs.command(
      "open",
      intl.formatMessage(msg.trackerOpenDescribe),
      (builder) =>
        builder.option("project", {
          type: "string",
          describe: intl.formatMessage(msg.optionProject),
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
          argv.project as string | undefined,
        );
      },
    );
  }

  async command(
    project?: string,
  ): Promise<TrackerRepoOpenCommandSuccessResponse | ErrorResponse> {
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();

    const repo = project
      ? new TrackerRepoValidator()
          .set(
            await useCurrentTrackerRepoStore
              .getState()
              .getTrackerRepoByProjectName(project),
          )
          .validateProjectNotNone(project)
          .first()
      : await useCurrentTrackerRepoStore.getState().getCurrentTrackerRepo();

    await shellService.open(repo.trackerPath);
    loggerService.info(`open ${repo.trackerPath}`);
    return {
      status: "ok",
      result: { path: repo.trackerPath },
    };
  }
}
