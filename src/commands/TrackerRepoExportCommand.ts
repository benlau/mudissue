import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { ObsidianKanbanGenerator } from "../utils/generators/ObsidianKanbanGenerator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type { ErrorResponse } from "../types/Response.ts";

export type TrackerRepoExportFormat = "obsidian-kanban";

export type TrackerRepoExportCommandInput = {
  format: TrackerRepoExportFormat;
  project?: string;
  output?: string;
};

const msg = defineMessages({
  trackerExportDescribe: {
    id: "cli.tracker.export.describe",
    defaultMessage: "Export tracker issues to an external format",
  },
  trackerExportFormat: {
    id: "cli.tracker.export.option.format",
    defaultMessage: "Export format",
  },
  trackerExportOutput: {
    id: "cli.tracker.export.option.output",
    defaultMessage: "Output file path (default: stdout)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  errorJsonNotSupported: {
    id: "cli.tracker.export.error.jsonNotSupported",
    defaultMessage: 'Command "{command}" does not support --json',
  },
});

export class TrackerRepoExportCommand extends Command {
  name = "tracker export";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new TrackerRepoExportCommand();
    return yargs.command(
      "export",
      intl.formatMessage(msg.trackerExportDescribe),
      (builder) =>
        builder
          .option("format", {
            type: "string",
            choices: ["obsidian-kanban"] as const,
            demandOption: true,
            describe: intl.formatMessage(msg.trackerExportFormat),
          })
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("output", {
            type: "string",
            describe: intl.formatMessage(msg.trackerExportOutput),
          }),
      async (argv) => {
        if (outputJsonMode(argv as HeadlessArgv)) {
          throw new Error(
            intl.formatMessage(msg.errorJsonNotSupported, {
              command: cmd.name,
            }),
          );
        }
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: false,
          interactive: false,
        });
        await cmd.runCommand(
          { outputJson: false },
          {
            format: argv.format as TrackerRepoExportFormat,
            project: argv.project as string | undefined,
            output: argv.output as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: TrackerRepoExportCommandInput,
  ): Promise<void | ErrorResponse> {
    const { project, output: outputPath } = input;

    const loggerService = LoggerService.getInstance();
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();

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

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();

    const content = await new ObsidianKanbanGenerator().generate({
      repo,
      globalConfig,
    });

    if (outputPath != null && outputPath.trim() !== "") {
      const outPath = path.resolve(shellService.cwd(), outputPath);
      await fileService.writeFile(outPath, `${content}\n`);
      loggerService.info(outPath);
      return;
    }

    loggerService.info(content);
  }
}
