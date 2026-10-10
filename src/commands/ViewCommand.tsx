import type { Argv } from "yargs";
import { render } from "ink";
import { defineMessages, IntlProvider } from "react-intl";
import { intl } from "../intl.ts";
import { CurrentIssueResolverHelper } from "../helpers/CurrentIssueResolverHelper.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { App } from "../App.tsx";
import { useReactSessionStore } from "../store/ReactSessionStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useTerminalSizeStore } from "../views/hooks/useTerminal.ts";

const msg = defineMessages({
  viewDescribe: {
    id: "cli.view.describe",
    defaultMessage: "View in text user interface",
  },
});

export type ViewCommandRegisterOptions = {
  /** Called when the default command (`mud` with no subcommand) cannot launch the TUI. */
  onLaunchFailure?: () => void;
};

function canLaunchInteractiveTui(): boolean {
  return process.stdout.isTTY === true;
}

export class ViewCommand extends Command {
  name = "view";

  static register(yargs: Argv, options?: ViewCommandRegisterOptions): Argv {
    const cmd = new ViewCommand();
    return yargs.command(
      ["view", "$0"],
      intl.formatMessage(msg.viewDescribe),
      () => {},
      async (argv) => {
        const isDefaultCommand = !argv._.map(String).includes("view");
        await ViewCommand.runInteractiveFromArgv(cmd, argv as HeadlessArgv, {
          onLaunchFailure: isDefaultCommand
            ? options?.onLaunchFailure
            : undefined,
        });
      },
    );
  }

  static async runInteractiveFromArgv(
    cmd: ViewCommand,
    argv: HeadlessArgv,
    options?: ViewCommandRegisterOptions,
  ): Promise<void> {
    const reportLaunchFailure = options?.onLaunchFailure;
    if (reportLaunchFailure && !canLaunchInteractiveTui()) {
      process.exitCode = 1;
      reportLaunchFailure();
      return;
    }

    const outputJson = outputJsonMode(argv);
    try {
      cmd.preprocessArgument(cmd.name, {
        debug: argv.debug === true,
        json: outputJson,
        interactive: true,
      });
    } catch (err) {
      if (!reportLaunchFailure) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(message + "\n");
      process.exitCode = 1;
      reportLaunchFailure();
      return;
    }

    useAppStore.getState().setDebug(argv.debug === true);
    await cmd.runCommand({ outputJson });
    if (reportLaunchFailure && process.exitCode === 1) {
      reportLaunchFailure();
    }
  }

  async command(): Promise<void> {
    await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const issuePath = repo.config.issue_path;
    if (
      issuePath !== undefined &&
      ShellService.getInstance().isAbsolute(issuePath)
    ) {
      const where = repo.configFilePath ?? repo.projectPath;
      throw new Error(
        `issue_path must be relative to tracker root (not absolute) in ${where}`,
      );
    }

    const issue = await CurrentIssueResolverHelper.findCurrentIssue();
    if (issue) {
      useAppStore.getState().openIssue(issue);
    }

    await useReactSessionStore.getState().run(
      () =>
        render(
          <IntlProvider locale="en" defaultLocale="en" messages={{}}>
            <App />
          </IntlProvider>,
          { exitOnCtrlC: false },
        ),
      {
        onResume: () => useTerminalSizeStore.getState().syncFromTerminal(),
      },
    );
  }
}
