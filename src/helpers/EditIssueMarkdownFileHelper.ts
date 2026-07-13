import { useAppStore } from "../store/AppStore.ts";
import { useTextEditDialogStore } from "../store/TextEditDialogStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";

export type EditIssueMarkdownFileOptions = {
  filePath?: string;
  initialLineIndex?: number;
};

export type EditIssueMarkdownFileResult = {
  isModified: boolean;
  lastLogicalLineIndex: number;
};

export class EditIssueMarkdownFileHelper {
  static async edit(
    issue: IssueFolder,
    options: EditIssueMarkdownFileOptions = {},
  ): Promise<EditIssueMarkdownFileResult> {
    const issueFolderStorage = new IssueFolderStorage(issue);
    const filePath =
      options.filePath ?? (await issueFolderStorage.findIssueFile());
    if (filePath === undefined) {
      return { isModified: false, lastLogicalLineIndex: 0 };
    }

    const { lastUpdatedTimestamp, lastLogicalLineIndex } =
      await useTextEditDialogStore.getState().open({
        filePath,
        initialLineIndex: options.initialLineIndex ?? 0,
      });
    if (lastUpdatedTimestamp === null) {
      return { isModified: false, lastLogicalLineIndex };
    }

    const updatedAt =
      await issueFolderStorage.touchUpdatedAtIfNotSuperseded(
        lastUpdatedTimestamp,
      );
    if (updatedAt !== null) {
      useAppStore.getState().applyIssueMetadataUpdate(issue.issueId, {
        title: issue.metadata?.title,
        status: issue.metadata?.status,
        priority: issue.metadata?.priority,
        updatedAt,
      });
    }

    return { isModified: true, lastLogicalLineIndex };
  }
}
