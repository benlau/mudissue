import type { Argv } from "yargs";
import { render } from "ink";
import { defineMessages, IntlProvider } from "react-intl";
import { intl } from "../intl.ts";
import { CurrentIssueResolverHelper } from "../helpers/CurrentIssueResolverHelper.ts";
import { ViewPathResolverHelper } from "../helpers/ViewPathResolverHelper.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { App } from "../App.tsx";
import { useReactSessionStore } from "../store/ReactSessionStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useTerminalSizeStore } from "../views/hooks/useTerminal.ts";
import type { TrackerRepo } from "../types/Tracker.ts";

const msg = defineMessages({
  viewDescribe: {
    id: "cli.view.describe",
    defaultMessage: "View in text user interface",
  },
  optionPath: {
    id: "cli.view.positional.path",
    defaultMessage: "Path under a recent project or tracker folder",
  },
  pickRecentProjectTitle: {
    id: "cli.view.pickRecentProject.title",
    defaultMessage: "Recent Projects",
  },
});

export type ViewCommandRegisterOptions = {
  /** Called when the default command (`mud` with no subcommand) cannot launch the TUI. */
  onLaunchFailure?: () => void;
};

export type ViewCommandRunOptions = ViewCommandRegisterOptions & {
  viewPath?: string;
};

function canLaunchInteractiveTui(): boolean {
  return process.stdout.isTTY === true;
}

export class ViewCommand extends Command {
  name = "view";

  static register(yargs: Argv, options?: ViewCommandRegisterOptions): Argv {
    const cmd = new ViewCommand();
    let instance = yargs.command(
      "view [path]",
      intl.formatMessage(msg.viewDescribe),
      (builder) =>
        builder.positional("path", {
          type: "string",
          describe: intl.formatMessage(msg.optionPath),
        }),
      async (argv) => {
        await ViewCommand.runInteractiveFromArgv(cmd, argv as HeadlessArgv, {
          viewPath: argv.path,
        });
      },
    );
    instance = instance.command(
      "$0",
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
    return instance;
  }

  static async runInteractiveFromArgv(
    cmd: ViewCommand,
    argv: HeadlessArgv,
    options?: ViewCommandRunOptions,
  ): Promise<void> {
    const reportLaunchFailure = options?.onLaunchFailure;
    if (!canLaunchInteractiveTui()) {
      process.exitCode = 1;
      reportLaunchFailure?.();
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
    await cmd.runCommand({ outputJson }, options?.viewPath);
    if (reportLaunchFailure && process.exitCode === 1) {
      reportLaunchFailure();
    }
  }

  async command(viewPath?: string): Promise<void> {
    if (viewPath !== undefined && viewPath !== "") {
      await this.commandWithViewPath(viewPath);
      return;
    }
    await this.commandFromCwd();
  }

  private async commandWithViewPath(viewPath: string): Promise<void> {
    const resolvedPath = ShellService.getInstance().realpath(viewPath);
    await ViewPathResolverHelper.assertViewPathExists(resolvedPath);
    const trackers =
      await ViewPathResolverHelper.findTrackerRepo(resolvedPath);

    if (trackers.length === 0) {
      ViewPathResolverHelper.throwViewPathNotUnderRecentTracker(resolvedPath);
    }

    let tracker: TrackerRepo;
    if (trackers.length === 1) {
      tracker = trackers[0]!;
    } else {
      const labels = trackers.map(ViewPathResolverHelper.formatTrackerPickItem);
      const picked = await this.askUserPickItem(labels, {
        title: intl.formatMessage(msg.pickRecentProjectTitle),
      });
      if (picked === null) {
        return;
      }
      const index = labels.indexOf(picked);
      tracker = trackers[index]!;
    }

    await useCurrentTrackerRepoStore
      .getState()
      .loadCurrentTrackerRepoByPath(tracker.projectPath);

    await this.assertIssuePathRelative();

    const issue = await ViewPathResolverHelper.resolveIssueFromViewPath(
      resolvedPath,
      (selector) => useCurrentTrackerRepoStore.getState().findIssue(selector),
    );
    if (issue) {
      useAppStore.getState().openIssue(issue);
    }

    try {
      await RegistryService.getInstance().upsertRecentProjects({
        name: tracker.name,
        projectPath: tracker.projectPath,
      });
    } catch {
      // fail silently
    }

    await this.renderApp();
  }

  private async commandFromCwd(): Promise<void> {
    await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();

    await this.assertIssuePathRelative();

    const issue = await CurrentIssueResolverHelper.findCurrentIssue();
    if (issue) {
      useAppStore.getState().openIssue(issue);
    }

    await this.renderApp();
  }

  private async assertIssuePathRelative(): Promise<void> {
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
  }

  private async renderApp(): Promise<void> {
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