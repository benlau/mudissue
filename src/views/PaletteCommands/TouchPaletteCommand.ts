import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { IssueFolderStorage } from "../../async/storage/IssueFolderStorage.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.touchIssue.label",
    defaultMessage: "Touch Issue",
  },
  description: {
    id: "views.paletteCommands.touchIssue.description",
    defaultMessage: "Set updated_at to the current time for the selected issue",
  },
  successToast: {
    id: "views.paletteCommands.touchIssue.successToast",
    defaultMessage: "{issue} touched",
  },
  successToastPlural: {
    id: "views.paletteCommands.touchIssue.successToastPlural",
    defaultMessage: "{count} issues touched",
  },
});

export class TouchPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "touchIssue";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issues = useAppStore.getState().getSelectedIssues();
    if (issues.length === 0) {
      return;
    }

    for (const issue of issues) {
      try {
        const storage = new IssueFolderStorage(issue);
        const issueFilePath = await storage.findIssueFile();
        const updatedAt = await storage.touchUpdatedAt();
        useAppStore.getState().applyIssueMetadataUpdate(issue.issueId, {
          title: issue.metadata?.title,
          status: issue.metadata?.status,
          priority: issue.metadata?.priority,
          updatedAt,
        });
        if (issueFilePath != null) {
          useFileWatcherStore.getState().requestReload(issueFilePath);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await useAlertDialogStore.getState().open(message);
        return;
      }
    }

    await useToastStore
      .getState()
      .info(
        intl.formatMessage(
          issues.length === 1
            ? messages.successToast
            : messages.successToastPlural,
          issues.length === 1
            ? { issue: issues[0]!.issueId }
            : { count: issues.length },
        ),
        { position: "center" },
      );
  }
}

export const touchPaletteCommand: PaletteCommand = new TouchPaletteCommand();
