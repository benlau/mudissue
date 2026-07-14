import { IssueSetPropertyCommand } from "../commands/IssueSetPropertyCommand.ts";
import { IssueFolderLinkFormatter } from "../foundation/formatter/IssueFolderLinkFormatter.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useFileWatcherStore } from "../store/FileWatcherStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { TrackerRepoConfigAccessor } from "../types/Tracker.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";

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

export class DuplicatedStatusRule {
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
    const rule = accessor.getEffectiveDuplicatedStatusRule();
    if (!rule.enabled) {
      return;
    }

    if (!gainedLinkageRef(oldMetadata, newMetadata, rule.duplicated_link)) {
      return;
    }

    const statusList = accessor.getEffectiveStatusList();
    if (!statusListIncludes(statusList, rule.duplicated_status)) {
      return;
    }

    const currentStatus = readStatus(newMetadata);
    if (currentStatus === rule.duplicated_status) {
      return;
    }

    const result = await new IssueSetPropertyCommand().command(
      issueFolder.issueId,
      "status",
      rule.duplicated_status,
      repo.name,
    );
    if (result.status === "ok") {
      useFileWatcherStore.getState().requestReload(result.result.issueFilePath);
    }
  }
}
