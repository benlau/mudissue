import { defineMessages } from "react-intl";
import { ClipboardService } from "../../services/ClipboardService.ts";
import { intl } from "../../intl.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { IssueFolderStorage } from "../../async/storage/IssueFolderStorage.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.copyToClipboard.label",
    defaultMessage: "Copy to Clipboard",
  },
  description: {
    id: "views.paletteCommands.copyToClipboard.description",
    defaultMessage: "Copy issue information to the clipboard",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.copyToClipboard.pickDialogTitle",
    defaultMessage: "Copy to Clipboard",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.copyToClipboard.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  issueIdLabel: {
    id: "views.paletteCommands.copyToClipboard.issueIdLabel",
    defaultMessage: "Issue ID",
  },
  filePathLabel: {
    id: "views.paletteCommands.copyToClipboard.filePathLabel",
    defaultMessage: "Issue markdown path",
  },
  copiedIssueIdToast: {
    id: "views.paletteCommands.copyToClipboard.copiedIssueIdToast",
    defaultMessage: "Copied Issue ID",
  },
  copiedFilePathToast: {
    id: "views.paletteCommands.copyToClipboard.copiedFilePathToast",
    defaultMessage: "Copied Issue Markdown File Path",
  },
  copyFailedToast: {
    id: "views.paletteCommands.copyToClipboard.copyFailedToast",
    defaultMessage: "Copy to clipboard failed: {detail}",
  },
});

export type CopyToClipboardTargetKind = "issueId" | "filePath";

export type CopyToClipboardTarget = {
  kind: CopyToClipboardTargetKind;
  label: string;
  value: string;
};

export class CopyToClipboardPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "copyToClipboard";
  readonly description = intl.formatMessage(messages.description);

  private async buildTargets(
    issue: IssueFolder,
  ): Promise<CopyToClipboardTarget[]> {
    const targets: CopyToClipboardTarget[] = [
      {
        kind: "issueId",
        label: intl.formatMessage(messages.issueIdLabel),
        value: issue.issueId,
      },
    ];

    const filePath = await new IssueFolderStorage(issue).findIssueFile();
    if (filePath != null) {
      targets.push({
        kind: "filePath",
        label: intl.formatMessage(messages.filePathLabel),
        value: filePath,
      });
    }

    return targets;
  }

  private async copyTextToClipboardWithToast(
    text: string,
    successToast: string,
  ): Promise<void> {
    try {
      await ClipboardService.getInstance().writeText(text);
      await useToastStore.getState().info(successToast);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await useToastStore
        .getState()
        .error(intl.formatMessage(messages.copyFailedToast, { detail }), {
          position: "center",
          persistent: true,
        });
    }
  }

  private successToastForTarget(target: CopyToClipboardTarget): string {
    return target.kind === "issueId"
      ? intl.formatMessage(messages.copiedIssueIdToast)
      : intl.formatMessage(messages.copiedFilePathToast);
  }

  async callback(): Promise<void> {
    const issue = useAppStore.getState().getSelectedIssues()[0];
    if (issue == null) {
      return;
    }

    const targets = await this.buildTargets(issue);
    if (targets.length === 0) {
      return;
    }

    const response = await usePickItemDialogStore
      .getState()
      .open(targets, (item) => [item.label, item.value], {
        title: intl.formatMessage(messages.pickDialogTitle),
        columns: [
          { minWidth: 16, grow: 1, ellipsisDirection: "right" },
          { minWidth: 24, grow: 2, ellipsisDirection: "left" },
        ],
        footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
        minWidth: 52,
        maxWidth: 86,
      });

    if (
      response.type !== PickItemDialogResponseType.Accepted ||
      response.acceptedValue == null
    ) {
      return;
    }

    const selected = response.acceptedValue;
    await this.copyTextToClipboardWithToast(
      selected.value,
      this.successToastForTarget(selected),
    );
  }
}

export const copyToClipboardPaletteCommand: PaletteCommand =
  new CopyToClipboardPaletteCommand();
