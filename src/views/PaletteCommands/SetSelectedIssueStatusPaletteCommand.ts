import { defineMessages } from "react-intl";
import { IssueSetPropertyCommand } from "../../commands/IssueSetPropertyCommand.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import { IssueMetadataChangedPostHookContext } from "../../store/IssueMetadataChangedPostHookStore.ts";
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
    id: "views.paletteCommands.setSelectedIssueStatus.label",
    defaultMessage: "Set Status",
  },
  description: {
    id: "views.paletteCommands.setSelectedIssueStatus.description",
    defaultMessage: "Change the status of the selected issue",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.setSelectedIssueStatus.pickDialogTitle",
    defaultMessage: "Set Status",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.setSelectedIssueStatus.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.setSelectedIssueStatus.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.setSelectedIssueStatus.successToast",
    defaultMessage: "Status set to {status}",
  },
  successToastPlural: {
    id: "views.paletteCommands.setSelectedIssueStatus.successToastPlural",
    defaultMessage: "Status set to {status} for {count} issues",
  },
});

function statusMatchesCurrent(
  name: string,
  currentStatus: string | undefined,
): boolean {
  if (currentStatus == null || currentStatus.trim() === "") {
    return false;
  }
  return name.trim().toLowerCase() === currentStatus.trim().toLowerCase();
}

function formatStatusLabel(
  name: string,
  currentStatus: string | undefined,
): string {
  const prefix = statusMatchesCurrent(name, currentStatus) ? "(*) " : "";
  return `${prefix}${name}`;
}

export class SetSelectedIssueStatusPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "setIssueStatus";
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

    const statusList = await useCurrentTrackerRepoStore
      .getState()
      .getStatusList(repo);

    const response = await usePickItemDialogStore
      .getState()
      .open(
        statusList,
        (item) => formatStatusLabel(item, firstIssue.metadata?.status),
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
        const postHookContext = new IssueMetadataChangedPostHookContext();
        await postHookContext.readOldMetadata(issue, issueRepo.name);

        const result = await new IssueSetPropertyCommand().command(
          issue.folderName,
          "status",
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
          status: selected,
          priority: issue.metadata?.priority,
          updatedAt,
        });
        if (result.status === "ok") {
          useFileWatcherStore
            .getState()
            .requestReload(result.result.issueFilePath);
          await postHookContext.notifyMetadataChanged();
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
            ? { status: selected }
            : { status: selected, count: issues.length },
        ),
        { position: "center" },
      );
  }
}

export const setSelectedIssueStatusPaletteCommand: PaletteCommand =
  new SetSelectedIssueStatusPaletteCommand();
