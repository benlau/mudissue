import { defineMessages } from "react-intl";
import { IssueSetPropertyCommand } from "../../commands/IssueSetPropertyCommand.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import { IssueFolderStorage } from "../../utils/storage/IssueFolderStorage.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.setSelectedIssuePriority.label",
    defaultMessage: "Set Priority",
  },
  description: {
    id: "views.paletteCommands.setSelectedIssuePriority.description",
    defaultMessage: "Change the priority of the selected issue",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.setSelectedIssuePriority.pickDialogTitle",
    defaultMessage: "Set Priority",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.setSelectedIssuePriority.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.setSelectedIssuePriority.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.setSelectedIssuePriority.successToast",
    defaultMessage: "Priority set to {priority}",
  },
  successToastPlural: {
    id: "views.paletteCommands.setSelectedIssuePriority.successToastPlural",
    defaultMessage: "Priority set to {priority} for {count} issues",
  },
});

function priorityMatchesCurrent(
  name: string,
  currentPriority: string | undefined,
): boolean {
  if (currentPriority == null || currentPriority.trim() === "") {
    return false;
  }
  return name.trim().toLowerCase() === currentPriority.trim().toLowerCase();
}

function formatPriorityLabel(
  name: string,
  currentPriority: string | undefined,
): string {
  const prefix = priorityMatchesCurrent(name, currentPriority) ? "(*) " : "";
  return `${prefix}${name}`;
}

export class SetSelectedIssuePriorityPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "setIssuePriority";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issues = useAppStore.getState().getSelectedIssues();
    if (issues.length === 0) {
      return;
    }

    const firstIssue = issues[0]!;
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .findTrackerRepoForIssueFolder(firstIssue);
    if (repo == null) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.repoNotFoundAlert));
      return;
    }

    const priorityTable = await useCurrentTrackerRepoStore
      .getState()
      .getPriorityTable(repo);

    const response = await usePickItemDialogStore
      .getState()
      .open(
        priorityTable.priorities,
        (item) => formatPriorityLabel(item, firstIssue.metadata?.priority),
        {
          title: intl.formatMessage(messages.pickDialogTitle),
          footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
        },
      );

    if (
      response.type !== PickItemDialogResponseType.Accepted ||
      response.acceptedValue == null
    ) {
      return;
    }

    const selected = response.acceptedValue;

    for (const issue of issues) {
      const issueRepo = await useCurrentTrackerRepoStore
        .getState()
        .findTrackerRepoForIssueFolder(issue);
      if (issueRepo == null) {
        await useAlertDialogStore
          .getState()
          .open(intl.formatMessage(messages.repoNotFoundAlert));
        return;
      }

      try {
        const result = await new IssueSetPropertyCommand().command(
          issue.folderName,
          "priority",
          selected,
          issueRepo.name,
        );
        if (result != null && isErrorResponse(result)) {
          await useAlertDialogStore.getState().open(result.error.message);
          return;
        }

        const updatedAt = await new IssueFolderStorage(issue).touchUpdatedAt();
        useAppStore.getState().applyIssueMetadataUpdate(issue.issueId, {
          title: issue.metadata?.title,
          status: issue.metadata?.status,
          priority: selected,
          updatedAt,
        });
        if (result.status === "ok") {
          useFileWatcherStore
            .getState()
            .requestReload(result.result.issueFilePath);
        }
      } catch (err) {
        if (isErrorResponse(err)) {
          await useAlertDialogStore.getState().open(err.error.message);
          return;
        }
        throw err;
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
            ? { priority: selected }
            : { priority: selected, count: issues.length },
        ),
        { position: "center" },
      );
  }
}

export const setSelectedIssuePriorityPaletteCommand: PaletteCommand =
  new SetSelectedIssuePriorityPaletteCommand();
