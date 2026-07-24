import * as path from "path";
import { defineMessages } from "react-intl";
import { ISSUE_FOLDER_NAME_MAX_LENGTH } from "../constants.ts";
import { BasicLayouter } from "../foundation/layouter/BasicLayouter.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { IssueChangeLabelCommandSuccessResult } from "../types/Response.ts";
import type { ErrorCode } from "../types/errors.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";

const messages = defineMessages({
  invalidIssueLabel: {
    id: "helpers.changeIssueLabel.invalidIssueLabel",
    defaultMessage:
      'Invalid issue label: "{label}". An issue label is an optional prefix followed by a number (e.g. 001, MI001, MI-001).',
  },
});

function throwChangeIssueLabelError(
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

function computeFolderNameForLabelChange(
  currentFolderName: string,
  newLabel: string,
): string {
  const suffix = IssueSelectorMatcher.extractIssueSuffix(currentFolderName);
  const folderName =
    suffix == null ? newLabel : IssueResource.withSlug(newLabel, suffix);
  return BasicLayouter.truncatePathSegment(
    folderName,
    ISSUE_FOLDER_NAME_MAX_LENGTH,
  );
}

export class ChangeIssueLabelHelper {
  async changeIssueLabel(
    repo: TrackerRepo,
    issue: IssueFolder,
    newLabel: string,
  ): Promise<IssueChangeLabelCommandSuccessResult> {
    const trimmedNewLabel = newLabel.trim();
    if (trimmedNewLabel === "") {
      throwChangeIssueLabelError(
        "CHANGE_ISSUE_LABEL_INVALID",
        "New issue label is required.",
        { new_label: newLabel },
      );
    }

    if (!IssueSelectorMatcher.isIssueLabel(trimmedNewLabel)) {
      throwChangeIssueLabelError(
        "CHANGE_ISSUE_LABEL_INVALID",
        intl.formatMessage(messages.invalidIssueLabel, {
          label: trimmedNewLabel,
        }),
        { new_label: trimmedNewLabel },
      );
    }

    if (trimmedNewLabel === issue.label) {
      throwChangeIssueLabelError(
        "CHANGE_ISSUE_LABEL_UNCHANGED",
        `Issue label is already "${trimmedNewLabel}".`,
        { new_label: trimmedNewLabel },
      );
    }

    const newFolderName = computeFolderNameForLabelChange(
      issue.issueId,
      trimmedNewLabel,
    );

    if (!IssueSelectorMatcher.isValidateFolderName(newFolderName)) {
      throwChangeIssueLabelError(
        "CHANGE_ISSUE_LABEL_INVALID_NEW_FOLDER",
        `Invalid computed issue folder name: "${newFolderName}".`,
        { new_issue_folder: newFolderName },
      );
    }

    const existingMatches = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(trimmedNewLabel, { project: repo.name });
    const conflicting = existingMatches.find(
      (match) => match.path !== issue.path,
    );
    if (conflicting) {
      throwChangeIssueLabelError(
        "CHANGE_ISSUE_LABEL_TARGET_EXISTS",
        `Another issue folder matches issue label "${trimmedNewLabel}".`,
        { path: trimmedNewLabel },
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
        throwChangeIssueLabelError(
          "CHANGE_ISSUE_LABEL_TARGET_EXISTS",
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
