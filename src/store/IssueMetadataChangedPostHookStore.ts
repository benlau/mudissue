import { create } from "zustand";
import type { IssueFolder } from "../types/Issue.ts";
import type { SystemRuleKey } from "../types/rules.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../async/storage/IssueMarkdownFileStorage.ts";

export type MetadataChangedPostHook = (
  issueFolder: IssueFolder,
  newMetadata: Record<string, unknown>,
  oldMetadata: Record<string, unknown>,
) => void | Promise<void>;

const hooksByKey = new Map<SystemRuleKey, MetadataChangedPostHook>();
let notifyDepth = 0;

export type IssueMetadataChangedPostHookStoreState = {
  registerPostHook: (key: SystemRuleKey, hook: MetadataChangedPostHook) => void;
  notifyMetadataChanged: (
    issueFolder: IssueFolder,
    newMetadata: Record<string, unknown>,
    oldMetadata: Record<string, unknown>,
  ) => Promise<void>;
};

export const useIssueMetadataChangedPostHookStore =
  create<IssueMetadataChangedPostHookStoreState>()(() => ({
    registerPostHook: (key, hook) => {
      hooksByKey.set(key, hook);
    },

    notifyMetadataChanged: async (issueFolder, newMetadata, oldMetadata) => {
      if (notifyDepth > 0) {
        return;
      }
      notifyDepth += 1;
      try {
        for (const hook of hooksByKey.values()) {
          await hook(issueFolder, newMetadata, oldMetadata);
        }
      } finally {
        notifyDepth -= 1;
      }
    },
  }));

export function resetIssueMetadataChangedPostHookStore(): void {
  hooksByKey.clear();
  notifyDepth = 0;
}

/**
 * Captures issue frontmatter before a mutation, then notifies registered
 * post-hooks with old vs new metadata after the write.
 */
export class IssueMetadataChangedPostHookContext {
  private issueFolder: IssueFolder | null = null;
  private oldMetadata: Record<string, unknown> = {};

  async readOldMetadata(
    issueFolder: IssueFolder,
    _project?: string,
  ): Promise<Record<string, unknown>> {
    this.issueFolder = issueFolder;
    this.oldMetadata =
      await IssueMetadataChangedPostHookContext.loadFrontmatter(issueFolder);
    return this.oldMetadata;
  }

  async notifyMetadataChanged(): Promise<void> {
    if (this.issueFolder == null) {
      return;
    }
    const newMetadata =
      await IssueMetadataChangedPostHookContext.loadFrontmatter(
        this.issueFolder,
      );
    await useIssueMetadataChangedPostHookStore
      .getState()
      .notifyMetadataChanged(this.issueFolder, newMetadata, this.oldMetadata);
  }

  private static async loadFrontmatter(
    issueFolder: IssueFolder,
  ): Promise<Record<string, unknown>> {
    const filePath = await new IssueFolderStorage(issueFolder).findIssueFile();
    if (filePath === undefined) {
      return {};
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    return { ...storage.getParsed().frontmatter };
  }
}
