import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useReactSessionStore } from "../../store/ReactSessionStore.ts";
import { FileService } from "../../services/FileService.ts";
import { ShellService } from "../../services/ShellService.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.openShell.label",
    defaultMessage: "Open Shell",
  },
  description: {
    id: "views.paletteCommands.openShell.description",
    defaultMessage: "Open an interactive shell in a project folder",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.openShell.pickDialogTitle",
    defaultMessage: "Open Shell",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.openShell.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  projectFolder: {
    id: "views.paletteCommands.openShell.projectFolder",
    defaultMessage: "Project folder",
  },
  trackerFolder: {
    id: "views.paletteCommands.openShell.trackerFolder",
    defaultMessage: "Tracker folder",
  },
  issueFolder: {
    id: "views.paletteCommands.openShell.issueFolder",
    defaultMessage: "Issue folder",
  },
  worktreeFolder: {
    id: "views.paletteCommands.openShell.worktreeFolder",
    defaultMessage: "Worktree folder",
  },
});

export type OpenShellTarget = {
  label: string;
  path: string;
};

export class OpenShellPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "openShell";
  readonly description = intl.formatMessage(messages.description);

  private async buildTargets(): Promise<OpenShellTarget[]> {
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const targets: OpenShellTarget[] = [
      {
        label: intl.formatMessage(messages.projectFolder),
        path: repo.projectPath,
      },
      {
        label: intl.formatMessage(messages.trackerFolder),
        path: repo.trackerPath,
      },
    ];

    const currentPage = useAppStore.getState().getCurrentPage();
    if (currentPage.name !== "ISSUE_VIEWER") {
      return targets;
    }
    const viewerIssue = currentPage.args.issue;

    targets.push({
      label: intl.formatMessage(messages.issueFolder),
      path: viewerIssue.path,
    });

    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(viewerIssue.issueId);
    if (await FileService.getInstance().exists(worktreePath)) {
      targets.push({
        label: intl.formatMessage(messages.worktreeFolder),
        path: worktreePath,
      });
    }

    return targets;
  }

  async callback(): Promise<void> {
    const targets = await this.buildTargets();
    const response = await usePickItemDialogStore
      .getState()
      .open(targets, (item) => [item.label, item.path], {
        title: intl.formatMessage(messages.pickDialogTitle),
        columns: [
          { minWidth: 16, grow: 1, ellipsisDirection: "right" },
          { minWidth: 24, grow: 2, ellipsisDirection: "left" },
        ],
        footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
        minWidth: 52,
        maxWidth: 86,
      });

    if (
      response.type !== PickItemDialogResponseType.Accepted ||
      !response.acceptedValue
    ) {
      return;
    }

    const selected = response.acceptedValue;
    await useReactSessionStore.getState().suspend();

    try {
      process.stdout.write(`${selected.path}\n`);
      ShellService.getInstance().openShell(selected.path);
    } finally {
      useReactSessionStore.getState().resume();
    }
  }
}

export const openShellPaletteCommand: PaletteCommand =
  new OpenShellPaletteCommand();
