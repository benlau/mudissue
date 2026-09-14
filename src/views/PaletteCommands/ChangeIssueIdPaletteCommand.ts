import { defineMessages } from "react-intl";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";
import { ChangeIssueIdHelper } from "../../helpers/ChangeIssueIdHelper.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import { useTextInputDialogStore } from "../../store/TextInputDialogStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.changeIssueId.label",
    defaultMessage: "Change Issue ID",
  },
  description: {
    id: "views.paletteCommands.changeIssueId.description",
    defaultMessage: "Change the issue ID of the first selected issue",
  },
  dialogTitle: {
    id: "views.paletteCommands.changeIssueId.dialogTitle",
    defaultMessage: "Change Issue ID",
  },
  dialogPrompt: {
    id: "views.paletteCommands.changeIssueId.dialogPrompt",
    defaultMessage: "New issue ID: ",
  },
  dialogPlaceholder: {
    id: "views.paletteCommands.changeIssueId.dialogPlaceholder",
    defaultMessage: "e.g. MI042",
  },
  invalidIdFormat: {
    id: "views.paletteCommands.changeIssueId.invalidIdFormat",
    defaultMessage: "Invalid issue ID format.",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.changeIssueId.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.changeIssueId.successToast",
    defaultMessage: "{oldFolder} → {newFolder}",
  },
  idAlreadyExistsToast: {
    id: "views.paletteCommands.changeIssueId.idAlreadyExistsToast",
    defaultMessage: "Issue ID {id} already exists",
  },
});

export class ChangeIssueIdPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "changeIssueId";
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

    const dialogResult = await useTextInputDialogStore.getState().open({
      title: intl.formatMessage(messages.dialogTitle),
      prompt: intl.formatMessage(messages.dialogPrompt),
      placeholder: intl.formatMessage(messages.dialogPlaceholder),
      initialValue: issue.label,
      validate: (value) => {
        if (value === "" || !IssueSelectorMatcher.isIssueLabel(value)) {
          return intl.formatMessage(messages.invalidIdFormat);
        }
        return null;
      },
    });
    if (dialogResult.type !== "accepted") {
      return;
    }

    const fileWatcherStore = useFileWatcherStore.getState();
    fileWatcherStore.stopAllWatchers();

    try {
      const result = await new ChangeIssueIdHelper().changeIssueId(
        repo,
        issue,
        dialogResult.value,
      );

      const refreshedList = await useAppStore.getState().refreshIssueLists();
      const updatedIssue = refreshedList.find(
        (item) => item.issueId === result.newIssueFolderName,
      );

      useAppStore.getState().clearTableRangeSelection();
      useAppStore.getState().setSelectedIssueId(result.newIssueFolderName);

      const currentPage = useAppStore.getState().getCurrentPage();
      if (currentPage.name === "ISSUE_VIEWER" && updatedIssue != null) {
        useAppStore.getState().replaceIssueViewer(updatedIssue);
      }

      await useToastStore.getState().info(
        intl.formatMessage(messages.successToast, {
          oldFolder: result.oldIssueFolderName,
          newFolder: result.newIssueFolderName,
        }),
        { position: "center" },
      );
    } catch (err) {
      if (isErrorResponse(err)) {
        if (err.error.code === "CHANGE_ISSUE_ID_TARGET_EXISTS") {
          await useToastStore.getState().error(
            intl.formatMessage(messages.idAlreadyExistsToast, {
              id: dialogResult.value,
            }),
            { position: "center" },
          );
          return;
        }
        await useAlertDialogStore.getState().open(err.error.message);
        return;
      }
      throw err;
    } finally {
      fileWatcherStore.resumeWatchers();
    }
  }
}

export const changeIssueIdPaletteCommand: PaletteCommand =
  new ChangeIssueIdPaletteCommand();
