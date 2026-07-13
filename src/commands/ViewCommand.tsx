import type { Argv } from "yargs";
import { render } from "ink";
import { defineMessages, IntlProvider } from "react-intl";
import { intl } from "../intl.ts";
import { FindIssueFromCwdHelper } from "../helpers/FindIssueFromCwdHelper.ts";
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

export class ViewCommand extends Command {
  name = "view";

  static register(yargs: Argv): Argv {
    const cmd = new ViewCommand();
    return yargs.command(
      "view",
      intl.formatMessage(msg.viewDescribe),
      () => {},
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: true,
        });
        useAppStore.getState().setDebug(argv.debug === true);
        await cmd.runCommand({ outputJson });
      },
    );
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

    const issue = await FindIssueFromCwdHelper.findIssueFromCwd();
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
