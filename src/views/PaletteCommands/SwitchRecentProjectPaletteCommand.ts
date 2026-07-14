import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { RegistryService } from "../../services/RegistryService.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.switchRecentProject.label",
    defaultMessage: "Switch Recent Project",
  },
  description: {
    id: "views.paletteCommands.switchRecentProject.description",
    defaultMessage: "Switch to another recently opened repository",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.switchRecentProject.pickDialogTitle",
    defaultMessage: "Recent Projects",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.switchRecentProject.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  noRecentProjectsAlert: {
    id: "views.paletteCommands.switchRecentProject.noRecentProjectsAlert",
    defaultMessage: "No recent projects",
  },
});

const MIN_LOADING_MS = 800;

export class SwitchRecentProjectPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "switchRecentProject";
  readonly shortKey = "c+r";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const list = await RegistryService.getInstance().getRecentProjects();
    const currentRepo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const currentProjectPath = path.resolve(currentRepo.projectPath);
    const otherProjects = list.filter(
      (p) => path.resolve(p.projectPath) !== currentProjectPath,
    );
    if (otherProjects.length === 0) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.noRecentProjectsAlert));
      return;
    }

    const response = await usePickItemDialogStore
      .getState()
      .open(otherProjects, (item) => [item.name, item.projectPath], {
        title: intl.formatMessage(messages.pickDialogTitle),
        columns: [
          { minWidth: 12, grow: 1, ellipsisDirection: "right" },
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
    useAppStore.setState({ isLoadingIssueList: true });
    const start = Date.now();
    try {
      await useCurrentTrackerRepoStore
        .getState()
        .loadCurrentTrackerRepoByPath(selected.projectPath);
      useAppStore.getState().reset();
      const refreshedList = await useAppStore.getState().refreshIssueLists();
      useAppStore
        .getState()
        .setSelectedIssueId(refreshedList[0]?.issueId ?? null);
      const elapsed = Date.now() - start;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((r) =>
          globalThis.setTimeout(r, MIN_LOADING_MS - elapsed),
        );
      }
    } finally {
      useAppStore.setState({ isLoadingIssueList: false });
    }
  }
}

export const switchRecentProjectPaletteCommand: PaletteCommand =
  new SwitchRecentProjectPaletteCommand();
