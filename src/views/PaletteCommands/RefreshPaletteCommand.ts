import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.refresh.label",
    defaultMessage: "Refresh",
  },
  description: {
    id: "views.paletteCommands.refresh.description",
    defaultMessage:
      "Reload the issue list, project config, and registry from disk",
  },
});

const MIN_LOADING_MS = 800;

export class RefreshPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "refresh";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const { selectedIssueId } = useAppStore.getState();
    useAppStore.setState({ isLoadingIssueList: true });
    const start = Date.now();
    try {
      const currentRepo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
      await useCurrentTrackerRepoStore
        .getState()
        .loadCurrentTrackerRepoByPath(currentRepo.projectPath);
      const refreshedList = await useAppStore.getState().refreshIssueLists();
      const stillSelected =
        selectedIssueId != null &&
        refreshedList.some((issue) => issue.issueId === selectedIssueId);
      useAppStore
        .getState()
        .setSelectedIssueId(
          stillSelected ? selectedIssueId : (refreshedList[0]?.issueId ?? null),
        );
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

export const refreshPaletteCommand: PaletteCommand =
  new RefreshPaletteCommand();
