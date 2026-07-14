import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { RegistryService } from "../../services/RegistryService.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.togglePinIssue.label",
    defaultMessage: "Toggle Pin Issue",
  },
  description: {
    id: "views.paletteCommands.togglePinIssue.description",
    defaultMessage: "Pin or unpin the selected issue at the top of the list",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.togglePinIssue.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  pinnedToast: {
    id: "views.paletteCommands.togglePinIssue.pinnedToast",
    defaultMessage: "{issue} pinned",
  },
  unpinnedToast: {
    id: "views.paletteCommands.togglePinIssue.unpinnedToast",
    defaultMessage: "{issue} unpinned",
  },
});

export class TogglePinIssuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "togglePinIssue";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issue = useAppStore.getState().getSelectedIssues()[0];
    if (issue == null) {
      return;
    }

    const repo = await useCurrentTrackerRepoStore
      .getState()
      .findTrackerRepoForIssueFolder(issue);
    if (repo == null) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.repoNotFoundAlert));
      return;
    }

    const repoList = await useCurrentTrackerRepoStore
      .getState()
      .getTrackerRepoList();
    const rootRepo = repoList[0];
    if (rootRepo == null) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.repoNotFoundAlert));
      return;
    }

    const pinned =
      await RegistryService.getInstance().togglePinnedIssueFolderName(
        rootRepo.projectPath,
        issue.issueId,
      );

    await useAppStore.getState().refreshIssueLists();

    await useToastStore
      .getState()
      .info(
        intl.formatMessage(
          pinned ? messages.pinnedToast : messages.unpinnedToast,
          { issue: issue.issueId },
        ),
      );
  }
}

export const togglePinIssuePaletteCommand: PaletteCommand =
  new TogglePinIssuePaletteCommand();
