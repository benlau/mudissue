import { defineMessages } from "react-intl";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";
import { ChangeIssueIdHelper } from "../../helpers/ChangeIssueIdHelper.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useTextInputDialogStore } from "../../store/TextInputDialogStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.changeId.label",
    defaultMessage: "Change Issue ID",
  },
  description: {
    id: "views.paletteCommands.changeId.description",
    defaultMessage: "Change the ID of the first selected issue",
  },
  dialogTitle: {
    id: "views.paletteCommands.changeId.dialogTitle",
    defaultMessage: "Change Issue ID",
  },
  dialogPrompt: {
    id: "views.paletteCommands.changeId.dialogPrompt",
    defaultMessage: "New ID: ",
  },
  dialogPlaceholder: {
    id: "views.paletteCommands.changeId.dialogPlaceholder",
    defaultMessage: "e.g. MI042",
  },
  invalidIdFormat: {
    id: "views.paletteCommands.changeId.invalidIdFormat",
    defaultMessage: "Invalid issue id format.",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.changeId.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.changeId.successToast",
    defaultMessage: "{oldFolder} → {newFolder}",
  },
  idAlreadyExistsToast: {
    id: "views.paletteCommands.changeId.idAlreadyExistsToast",
    defaultMessage: "Issue ID {id} already exists",
  },
});

export class ChangeIdPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "changeId";
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
      initialValue: issue.issueId,
      validate: (value) => {
        if (value === "" || !IssueSelectorMatcher.isIssueId(value)) {
          return intl.formatMessage(messages.invalidIdFormat);
        }
        return null;
      },
    });
    if (dialogResult.type !== "accepted") {
      return;
    }

    try {
      const result = await new ChangeIssueIdHelper().changeIssueId(
        repo,
        issue,
        dialogResult.value,
      );

      const refreshedList = await useAppStore.getState().refreshIssueLists();
      const updatedIssue = refreshedList.find(
        (item) => item.folderName === result.newIssueFolderName,
      );

      useAppStore.getState().clearTableRangeSelection();
      useAppStore.getState().setSelectedFolderName(result.newIssueFolderName);

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
    }
  }
}

export const changeIdPaletteCommand: PaletteCommand =
  new ChangeIdPaletteCommand();
