import { defineMessages } from "react-intl";
import { IssueArchiveCommand } from "../../commands/IssueArchiveCommand.ts";
import { intl } from "../../intl.ts";
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
    id: "views.paletteCommands.archiveSelectedIssue.label",
    defaultMessage: "Archive Selected Issue",
  },
  description: {
    id: "views.paletteCommands.archiveSelectedIssue.description",
    defaultMessage: "Move the selected issue folder into issues/.archive",
  },
  confirmTitle: {
    id: "views.paletteCommands.archiveSelectedIssue.confirmTitle",
    defaultMessage: "Archive issue?",
  },
  confirmTitlePlural: {
    id: "views.paletteCommands.archiveSelectedIssue.confirmTitlePlural",
    defaultMessage: "Archive issues?",
  },
  confirmMessage: {
    id: "views.paletteCommands.archiveSelectedIssue.confirmMessage",
    defaultMessage:
      "Archive {folderName} from project {projectName} into issues/.archive?",
  },
  confirmMessagePlural: {
    id: "views.paletteCommands.archiveSelectedIssue.confirmMessagePlural",
    defaultMessage:
      "Archive {count} issues from project {projectName} into issues/.archive?",
  },
  confirmLabel: {
    id: "views.paletteCommands.archiveSelectedIssue.confirmLabel",
    defaultMessage: "Archive",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.archiveSelectedIssue.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.archiveSelectedIssue.successToast",
    defaultMessage: "{issue} archived",
  },
  successToastPlural: {
    id: "views.paletteCommands.archiveSelectedIssue.successToastPlural",
    defaultMessage: "{count} issues archived",
  },
});

function minListIndexForIssues(
  list: IssueFolder[],
  targets: IssueFolder[],
): number {
  const indices = targets
    .map((target) => list.findIndex((item) => item.issueId === target.issueId))
    .filter((index) => index >= 0);
  return indices.length === 0 ? -1 : Math.min(...indices);
}

export class ArchiveSelectedIssuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "archiveIssue";
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
          ? { folderName: firstIssue.issueId, projectName: repo.name }
          : { count: issues.length, projectName: repo.name },
      ),
      confirmLabel: intl.formatMessage(messages.confirmLabel),
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
        const result = await new IssueArchiveCommand().command(
          issue.issueId,
          issueRepo.name,
        );
        if (result != null && isErrorResponse(result)) {
          await useAlertDialogStore.getState().open(result.error.message);
          return;
        }
      } catch (err) {
        if (isErrorResponse(err)) {
          await useAlertDialogStore.getState().open(err.error.message);
          return;
        }
        throw err;
      }
    }

    const archivedIssueIds = new Set(issues.map((issue) => issue.issueId));
    if (
      currentPage.name === "ISSUE_VIEWER" &&
      archivedIssueIds.has(currentPage.args.issue.issueId)
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
      .setSelectedIssueId(
        nextIndex >= 0 ? (refreshedList[nextIndex]?.issueId ?? null) : null,
      );

    await useToastStore
      .getState()
      .info(
        intl.formatMessage(
          issues.length === 1
            ? messages.successToast
            : messages.successToastPlural,
          issues.length === 1
            ? { issue: firstIssue.issueId }
            : { count: issues.length },
        ),
      );
  }
}

export const archiveSelectedIssuePaletteCommand: PaletteCommand =
  new ArchiveSelectedIssuePaletteCommand();
