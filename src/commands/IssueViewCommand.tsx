import type { Argv } from "yargs";
import { render } from "ink";
import { defineMessages, IntlProvider } from "react-intl";
import { intl } from "../intl.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { App } from "../App.tsx";
import { useReactSessionStore } from "../store/ReactSessionStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useTerminalSizeStore } from "../views/hooks/useTerminal.ts";

export type IssueViewCommandProps = {
  renderInk?: typeof render;
};

const msg = defineMessages({
  issueViewDescribe: {
    id: "cli.issue.view.describe",
    defaultMessage: "Open the issue in the text user interface (issue viewer)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueIdOrFolder: {
    id: "cli.common.option.issueIdOrFolder",
    defaultMessage: "Issue ID or issue folder name",
  },
});

export class IssueViewCommand extends Command {
  name = "issue view";

  private renderInk: typeof render;

  constructor(props: IssueViewCommandProps = {}) {
    super();
    this.renderInk = props.renderInk ?? render;
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueViewCommand();
    return yargs.command(
      "view <issue_selector>",
      intl.formatMessage(msg.issueViewDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueIdOrFolder),
            type: "string",
            demandOption: true,
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: true,
        });
        useAppStore.getState().setDebug(argv.debug === true);
        await cmd.runCommand(
          { outputJson },
          argv.issue_selector ?? "",
          argv.project,
        );
      },
    );
  }

  async command(issueSelector: string, project?: string): Promise<void> {
    if (project) {
      new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    }
    const folders = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(issueSelector, {
        project,
      });
    const issue = new IssueFolderValidator()
      .set(folders)
      .validateIssueNotNone()
      .validateIssueNotMultiple()
      .first();

    useAppStore.getState().openIssue(issue, { project });

    await useReactSessionStore.getState().run(
      () =>
        this.renderInk(
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
