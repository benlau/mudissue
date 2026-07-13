import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  TrackerRepoLocateCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type TrackerRepoLocateCommandSuccessResponse =
  SuccessResponse<TrackerRepoLocateCommandSuccessResult>;

const msg = defineMessages({
  trackerLocateDescribe: {
    id: "cli.tracker.locate.describe",
    defaultMessage: "Print the location of the current issue tracker folder",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
});

export class TrackerRepoLocateCommand extends Command {
  name = "tracker locate";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new TrackerRepoLocateCommand();
    return yargs.command(
      "locate",
      intl.formatMessage(msg.trackerLocateDescribe),
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
  ): Promise<TrackerRepoLocateCommandSuccessResponse | ErrorResponse> {
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

    loggerService.info(repo.trackerPath);
    return { status: "ok", result: { path: repo.trackerPath } };
  }
}
