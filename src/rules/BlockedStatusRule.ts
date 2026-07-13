import { IssueSetPropertyCommand } from "../commands/IssueSetPropertyCommand.ts";
import { IssueFolderLinkFormatter } from "../foundation/formatter/IssueFolderLinkFormatter.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useFileWatcherStore } from "../store/FileWatcherStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { TrackerRepoConfigAccessor } from "../types/Tracker.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../utils/storage/IssueMarkdownFileStorage.ts";

function linkageFolderNames(
  metadata: Record<string, unknown>,
  field: string,
): Set<string> {
  const values = IssueFolderStorage.normalizeLinkageValues(metadata[field]);
  return new Set(
    values.map((value) => IssueFolderLinkFormatter.stripFolderReference(value)),
  );
}

function gainedLinkageRef(
  oldMetadata: Record<string, unknown>,
  newMetadata: Record<string, unknown>,
  field: string,
): boolean {
  const before = linkageFolderNames(oldMetadata, field);
  const after = linkageFolderNames(newMetadata, field);
  for (const name of after) {
    if (!before.has(name)) {
      return true;
    }
  }
  return false;
}

function statusListIncludes(statusList: string[], status: string): boolean {
  const key = status.trim().toLowerCase();
  return statusList.some((entry) => entry.trim().toLowerCase() === key);
}

function readStatus(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.status;
  return typeof value === "string" ? value : undefined;
}

export class BlockedStatusRule {
  async onMetadataChanged(
    issueFolder: IssueFolder,
    newMetadata: Record<string, unknown>,
    oldMetadata: Record<string, unknown>,
  ): Promise<void> {
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .findTrackerRepoForIssueFolder(issueFolder);
    if (repo == null) {
      return;
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const accessor = new TrackerRepoConfigAccessor(repo.config, globalConfig);
    const rule = accessor.getEffectiveBlockedStatusRule();
    if (!rule.enabled) {
      return;
    }

    const statusList = accessor.getEffectiveStatusList();

    if (gainedLinkageRef(oldMetadata, newMetadata, rule.blocked_by_link)) {
      if (statusListIncludes(statusList, rule.blocked_status)) {
        await this.setStatus(issueFolder, rule.blocked_status, repo.name);
      }
    }

    const oldStatus = readStatus(oldMetadata);
    const newStatus = readStatus(newMetadata);
    if (
      newStatus == null ||
      newStatus === oldStatus ||
      !accessor.isResolved(newStatus)
    ) {
      return;
    }

    const blockingTargets = linkageFolderNames(newMetadata, rule.blocking_link);
    if (blockingTargets.size === 0) {
      return;
    }

    if (!statusListIncludes(statusList, rule.unblocked_status)) {
      return;
    }

    for (const targetFolderName of blockingTargets) {
      await this.maybeUnblockIssue(
        targetFolderName,
        repo.name,
        rule.blocked_by_link,
        rule.unblocked_status,
        (status) => accessor.isResolved(status),
      );
    }
  }

  private async maybeUnblockIssue(
    targetFolderName: string,
    project: string,
    blockedByLink: string,
    unblockedStatus: string,
    isResolved: (status: string) => boolean,
  ): Promise<void> {
    const folders = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(targetFolderName, { project });
    if (folders.length !== 1) {
      return;
    }
    const blockedIssue = folders[0]!;
    const frontmatter = await this.loadFrontmatter(blockedIssue);
    const blockerNames = linkageFolderNames(frontmatter, blockedByLink);
    if (blockerNames.size === 0) {
      return;
    }

    for (const blockerName of blockerNames) {
      const blockerFolders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(blockerName, { project });
      if (blockerFolders.length !== 1) {
        return;
      }
      const blockerFrontmatter = await this.loadFrontmatter(blockerFolders[0]!);
      const blockerStatus = readStatus(blockerFrontmatter);
      if (blockerStatus == null || !isResolved(blockerStatus)) {
        return;
      }
    }

    await this.setStatus(blockedIssue, unblockedStatus, project);
  }

  private async setStatus(
    issueFolder: IssueFolder,
    status: string,
    project: string,
  ): Promise<void> {
    const current = await this.loadFrontmatter(issueFolder);
    if (readStatus(current) === status) {
      return;
    }
    const result = await new IssueSetPropertyCommand().command(
      issueFolder.folderName,
      "status",
      status,
      project,
    );
    if (result.status === "ok") {
      useFileWatcherStore.getState().requestReload(result.result.issueFilePath);
    }
  }

  private async loadFrontmatter(
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
