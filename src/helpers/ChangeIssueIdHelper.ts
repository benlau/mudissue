import * as path from "path";
import { ISSUE_FOLDER_NAME_MAX_LENGTH } from "../constants.ts";
import { BasicLayouter } from "../foundation/layouter/BasicLayouter.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import { FileService } from "../services/FileService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { IssueChangeIdCommandSuccessResult } from "../types/Response.ts";
import type { ErrorCode } from "../types/errors.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";

function throwChangeIssueIdError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw {
    status: "error" as const,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export class ChangeIssueIdHelper {
  static computeFolderNameForIdChange(
    currentFolderName: string,
    newIssueId: string,
  ): string {
    const suffix = IssueSelectorMatcher.extractIssueSuffix(currentFolderName);
    const folderName =
      suffix == null ? newIssueId : IssueResource.withSlug(newIssueId, suffix);
    return BasicLayouter.truncatePathSegment(
      folderName,
      ISSUE_FOLDER_NAME_MAX_LENGTH,
    );
  }

  async changeIssueId(
    repo: TrackerRepo,
    issue: IssueFolder,
    newIssueId: string,
  ): Promise<IssueChangeIdCommandSuccessResult> {
    const trimmedNewId = newIssueId.trim();
    if (trimmedNewId === "") {
      throwChangeIssueIdError(
        "CHANGE_ISSUE_ID_INVALID",
        "New issue id is required.",
        { new_id: newIssueId },
      );
    }

    if (!IssueSelectorMatcher.isIssueLabel(trimmedNewId)) {
      throwChangeIssueIdError(
        "CHANGE_ISSUE_ID_INVALID",
        `Invalid issue id: "${trimmedNewId}".`,
        { new_id: trimmedNewId },
      );
    }

    if (trimmedNewId === issue.label) {
      throwChangeIssueIdError(
        "CHANGE_ISSUE_ID_UNCHANGED",
        `Issue id is already "${trimmedNewId}".`,
        { new_id: trimmedNewId },
      );
    }

    const newFolderName = ChangeIssueIdHelper.computeFolderNameForIdChange(
      issue.issueId,
      trimmedNewId,
    );

    if (!IssueSelectorMatcher.isValidateFolderName(newFolderName)) {
      throwChangeIssueIdError(
        "CHANGE_ISSUE_ID_INVALID_NEW_FOLDER",
        `Invalid computed issue folder name: "${newFolderName}".`,
        { new_issue_folder: newFolderName },
      );
    }

    const existingMatches = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(trimmedNewId, { project: repo.name });
    const conflicting = existingMatches.find(
      (match) => match.path !== issue.path,
    );
    if (conflicting) {
      throwChangeIssueIdError(
        "CHANGE_ISSUE_ID_TARGET_EXISTS",
        `Another issue folder matches issue id "${trimmedNewId}".`,
        { path: trimmedNewId },
      );
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const trackerRepoStorage = new TrackerRepoStorage(repo, globalConfig);
    const issueRoot = trackerRepoStorage.getIssuePath();
    const currentPath = issue.path;
    const targetPath = path.join(issueRoot, newFolderName);
    const fileService = FileService.getInstance();

    if (targetPath !== currentPath) {
      if (await fileService.exists(targetPath)) {
        throwChangeIssueIdError(
          "CHANGE_ISSUE_ID_TARGET_EXISTS",
          `Target folder already exists: ${targetPath}.`,
          { path: targetPath },
        );
      }
    }

    const renameResult = await trackerRepoStorage.renameIssue(
      issue,
      newFolderName,
    );

    const registry = RegistryService.getInstance();
    const pinned = await registry.getPinnedIssueFolderNames(repo.projectPath);
    const pinnedIndex = pinned.indexOf(issue.issueId);
    if (pinnedIndex >= 0) {
      pinned[pinnedIndex] = renameResult.newFolderName;
      await registry.setPinnedIssueFolderNames(pinned, repo.projectPath);
    }

    return {
      oldIssueFolderName: renameResult.oldFolderName,
      newIssueFolderName: renameResult.newFolderName,
    };
  }
}
