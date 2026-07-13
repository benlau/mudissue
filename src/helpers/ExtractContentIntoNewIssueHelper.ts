import { defineMessages } from "react-intl";
import { IssueFolderLinkFormatter } from "../foundation/formatter/IssueFolderLinkFormatter.ts";
import { MarkdownParser } from "../foundation/parser/MarkdownParser.ts";
import { intl } from "../intl.ts";
import { useAlertDialogStore } from "../store/AlertDialogStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { MarkdownViewerHandleStoreManager } from "../store/MarkdownViewerHandleStore.ts";
import { useToastStore } from "../store/ToastStore.ts";
import { CreateIssueHelper } from "./CreateIssueHelper.ts";

const messages = defineMessages({
  noSelection: {
    id: "helpers.extractContentIntoNewIssue.noSelection",
    defaultMessage: "Select content with V before extracting",
  },
  noTitle: {
    id: "helpers.extractContentIntoNewIssue.noTitle",
    defaultMessage: "Selected content has no title",
  },
  success: {
    id: "helpers.extractContentIntoNewIssue.success",
    defaultMessage: "Extracted into a new sub-issue",
  },
});

function deriveTitleFromSelection(content: string): string {
  const headingTitle = MarkdownParser.extractTitleFromMarkdown(content);
  if (headingTitle !== "") {
    return headingTitle;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "") {
      return trimmed;
    }
  }
  return "";
}

export class ExtractContentIntoNewIssueHelper {
  async extract(): Promise<void> {
    const parent = useAppStore.getState().getSelectedIssues()[0];
    if (parent == null) {
      return;
    }

    const viewerStore = MarkdownViewerHandleStoreManager.getLatest();
    if (viewerStore == null) {
      await useToastStore
        .getState()
        .info(intl.formatMessage(messages.noSelection));
      return;
    }

    const content = viewerStore.getState().getSelectedContent();
    if (content == null || content.trim() === "") {
      await useToastStore
        .getState()
        .info(intl.formatMessage(messages.noSelection));
      return;
    }

    const title = deriveTitleFromSelection(content);
    if (title === "") {
      await useToastStore.getState().info(intl.formatMessage(messages.noTitle));
      return;
    }

    const createIssueHelper = new CreateIssueHelper();

    try {
      const created = await createIssueHelper.createSubissueOnDisk(
        title,
        parent,
        content,
      );
      const link = IssueFolderLinkFormatter.formatFolderReference(
        created.folderName,
        "long",
      );
      const replaced = viewerStore.getState().replaceSelection(link);
      if (replaced == null) {
        await useToastStore
          .getState()
          .info(intl.formatMessage(messages.noSelection));
        return;
      }

      await viewerStore.getState().save();
      await createIssueHelper.openCreatedIssue(created);
      await useToastStore
        .getState()
        .info(intl.formatMessage(messages.success), { position: "center" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await useAlertDialogStore.getState().open(message);
    }
  }
}
