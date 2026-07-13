import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { IssueFolderStorage } from "../../utils/storage/IssueFolderStorage.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";
import { clamp } from "../../types/maths.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.removeSelectedIssue.label",
    defaultMessage: "Remove Selected Issue",
  },
  description: {
    id: "views.paletteCommands.removeSelectedIssue.description",
    defaultMessage: "Delete the selected issue folder from disk",
  },
  confirmTitle: {
    id: "views.paletteCommands.removeSelectedIssue.confirmTitle",
    defaultMessage: "Remove issue?",
  },
  confirmTitlePlural: {
    id: "views.paletteCommands.removeSelectedIssue.confirmTitlePlural",
    defaultMessage: "Remove issues?",
  },
  confirmMessage: {
    id: "views.paletteCommands.removeSelectedIssue.confirmMessage",
    defaultMessage:
      "Remove {folderName} from project {projectName}? This cannot be undone.",
  },
  confirmMessagePlural: {
    id: "views.paletteCommands.removeSelectedIssue.confirmMessagePlural",
    defaultMessage:
      "Remove {count} issues from project {projectName}? This cannot be undone.",
  },
  confirmLabel: {
    id: "views.paletteCommands.removeSelectedIssue.confirmLabel",
    defaultMessage: "Remove",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.removeSelectedIssue.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  removeFailedAlert: {
    id: "views.paletteCommands.removeSelectedIssue.removeFailedAlert",
    defaultMessage:
      "Cannot remove issue folder: it must be empty or contain only the issue markdown file (and optional files/ attachments).",
  },
  successToast: {
    id: "views.paletteCommands.removeSelectedIssue.successToast",
    defaultMessage: "{issue} removed",
  },
  successToastPlural: {
    id: "views.paletteCommands.removeSelectedIssue.successToastPlural",
    defaultMessage: "{count} issues removed",
  },
});

function minListIndexForIssues(
  list: IssueFolder[],
  targets: IssueFolder[],
): number {
  const indices = targets
    .map((target) =>
      list.findIndex((item) => item.folderName === target.folderName),
    )
    .filter((index) => index >= 0);
  return indices.length === 0 ? -1 : Math.min(...indices);
}

export class RemoveSelectedIssuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "removeIssue";
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

    const confirmResult = await useConfirmationDialogStore.getState().open({
      title: intl.formatMessage(
        issues.length === 1
          ? messages.confirmTitle
          : messages.confirmTitlePlural,
      ),
      message: intl.formatMessage(
        issues.length === 1
          ? messages.confirmMessage
          : messages.confirmMessagePlural,
        issues.length === 1
          ? { folderName: firstIssue.folderName, projectName: repo.name }
          : { count: issues.length, projectName: repo.name },
      ),
      confirmLabel: intl.formatMessage(messages.confirmLabel),
      variant: "destructive",
    });
    if (confirmResult.type !== "accepted") {
      return;
    }

    const { mainIssueLists } = useAppStore.getState();
    const currentPage = useAppStore.getState().getCurrentPage();
    const oldIndex = minListIndexForIssues(mainIssueLists ?? [], issues);

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
        const removed = await new IssueFolderStorage(issue).remove();
        if (removed === null) {
          await useToastStore
            .getState()
            .error(intl.formatMessage(messages.removeFailedAlert));
          return;
        }
      } catch (err) {
        const detail = isErrorResponse(err)
          ? err.error.message
          : err instanceof Error
            ? err.message
            : String(err);
        await useToastStore.getState().error(detail);
        return;
      }
    }

    const removedIssueIds = new Set(issues.map((issue) => issue.issueId));
    if (
      currentPage.name === "ISSUE_VIEWER" &&
      removedIssueIds.has(currentPage.args.issue.issueId)
    ) {
      useAppStore.getState().closeIssue();
    }

    await useAppStore.getState().refreshIssueLists();
    useAppStore.getState().clearTableRangeSelection();
    const refreshedList = useAppStore.getState().mainIssueLists ?? [];
    const nextIndex =
      refreshedList.length === 0
        ? -1
        : clamp(oldIndex, 0, refreshedList.length - 1);
    useAppStore
      .getState()
      .setSelectedFolderName(
        nextIndex >= 0 ? (refreshedList[nextIndex]?.folderName ?? null) : null,
      );

    await useToastStore
      .getState()
      .info(
        intl.formatMessage(
          issues.length === 1
            ? messages.successToast
            : messages.successToastPlural,
          issues.length === 1
            ? { issue: firstIssue.folderName }
            : { count: issues.length },
        ),
      );
  }
}

export const removeSelectedIssuePaletteCommand: PaletteCommand =
  new RemoveSelectedIssuePaletteCommand();
