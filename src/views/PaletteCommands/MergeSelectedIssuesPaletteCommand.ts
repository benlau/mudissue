import { defineMessages } from "react-intl";
import { CreateIssueHelper } from "../../helpers/CreateIssueHelper.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useTextInputDialogStore } from "../../store/TextInputDialogStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";
import { IssueMergeSectionGenerator } from "../../utils/generators/IssueMergeSectionGenerator.ts";
import { IssueFolderStorage } from "../../utils/storage/IssueFolderStorage.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.mergeSelectedIssues.label",
    defaultMessage: "Merge Selected Issues",
  },
  description: {
    id: "views.paletteCommands.mergeSelectedIssues.description",
    defaultMessage: "Merge selected issues into a new issue",
  },
  singleIssueAlert: {
    id: "views.paletteCommands.mergeSelectedIssues.singleIssueAlert",
    defaultMessage: "Cannot merge a single selected issue.",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.mergeSelectedIssues.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  confirmMergeTitle: {
    id: "views.paletteCommands.mergeSelectedIssues.confirmMergeTitle",
    defaultMessage: "Merge issues?",
  },
  confirmMergeMessage: {
    id: "views.paletteCommands.mergeSelectedIssues.confirmMergeMessage",
    defaultMessage: "Merge {count} selected issues into a new issue?",
  },
  confirmMergeLabel: {
    id: "views.paletteCommands.mergeSelectedIssues.confirmMergeLabel",
    defaultMessage: "Merge",
  },
  titleDialogTitle: {
    id: "views.paletteCommands.mergeSelectedIssues.titleDialogTitle",
    defaultMessage: "Merged issue title",
  },
  titleDialogPrompt: {
    id: "views.paletteCommands.mergeSelectedIssues.titleDialogPrompt",
    defaultMessage: "Title: ",
  },
  removeFailedAlert: {
    id: "views.paletteCommands.mergeSelectedIssues.removeFailedAlert",
    defaultMessage:
      "Cannot remove issue folder: it must be empty or contain only the issue markdown file (and optional files/ attachments).",
  },
  successToastWithRemove: {
    id: "views.paletteCommands.mergeSelectedIssues.successToastWithRemove",
    defaultMessage: "Merged into {issue}; original issues removed",
  },
});

export class MergeSelectedIssuesPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "mergeSelectedIssues";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issues = useAppStore.getState().getSelectedIssues();
    if (issues.length === 0) {
      return;
    }
    if (issues.length === 1) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.singleIssueAlert));
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

    const confirmMergeResult = await useConfirmationDialogStore
      .getState()
      .open({
        title: intl.formatMessage(messages.confirmMergeTitle),
        message: intl.formatMessage(messages.confirmMergeMessage, {
          count: issues.length,
        }),
        confirmLabel: intl.formatMessage(messages.confirmMergeLabel),
      });
    if (confirmMergeResult.type !== "accepted") {
      return;
    }

    const titleResult = await useTextInputDialogStore.getState().open({
      title: intl.formatMessage(messages.titleDialogTitle),
      prompt: intl.formatMessage(messages.titleDialogPrompt),
    });
    if (titleResult.type !== "accepted") {
      return;
    }

    let createdIssueId: string;
    try {
      const mergedContent =
        await new IssueMergeSectionGenerator().renderMergedContent(issues);
      const created = await new CreateIssueHelper().createIssue(
        titleResult.value.trim(),
        undefined,
        mergedContent,
      );
      createdIssueId = created.issueId;
    } catch (err) {
      const detail = isErrorResponse(err)
        ? err.error.message
        : err instanceof Error
          ? err.message
          : String(err);
      await useToastStore.getState().error(detail);
      return;
    }

    for (const issue of issues) {
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

    await useAppStore.getState().refreshIssueLists();
    useAppStore.getState().clearTableRangeSelection();

    await useToastStore.getState().info(
      intl.formatMessage(messages.successToastWithRemove, {
        issue: createdIssueId,
      }),
    );
  }
}

export const mergeSelectedIssuesPaletteCommand: PaletteCommand =
  new MergeSelectedIssuesPaletteCommand();
