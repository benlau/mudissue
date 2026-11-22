import * as path from "path";
import { defineMessages } from "react-intl";
import { TrackerRepoStorage } from "../async/storage/TrackerRepoStorage.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import { FileService } from "../services/FileService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { ErrorResponse } from "../types/Response.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import type { RecentProjectItem } from "../types/RecentProject.ts";
import { intl } from "../intl.ts";

const messages = defineMessages({
  pathNotFound: {
    id: "helpers.viewPathResolver.pathNotFound",
    defaultMessage: "Path does not exist: {path}",
  },
  noRecentProjects: {
    id: "helpers.viewPathResolver.noRecentProjects",
    defaultMessage: "No recent projects",
  },
  notUnderRecentTracker: {
    id: "helpers.viewPathResolver.notUnderRecentTracker",
    defaultMessage: "Path is not under any tracker folder of a recent project",
  },
});

export class ViewPathResolverHelper {
  static isPathUnderTrackerPath(
    resolvedPath: string,
    trackerPath: string,
  ): boolean {
    const pathResolved = path.resolve(resolvedPath);
    const rootResolved = path.resolve(trackerPath);
    return (
      pathResolved === rootResolved ||
      pathResolved.startsWith(rootResolved + path.sep)
    );
  }

  static isIssueSelectorPathSegment(segment: string): boolean {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      return false;
    }
    return (
      IssueSelectorMatcher.isValidateFolderName(trimmed) ||
      IssueSelectorMatcher.isIssueNumber(trimmed) ||
      IssueSelectorMatcher.isIssueLabel(trimmed)
    );
  }

  static async assertViewPathExists(resolvedPath: string): Promise<void> {
    const fileService = FileService.getInstance();
    const exists = await fileService.exists(resolvedPath).catch(() => false);
    if (!exists) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "VIEW_PATH_NOT_FOUND",
          message: intl.formatMessage(messages.pathNotFound, {
            path: resolvedPath,
          }),
          details: { path: resolvedPath },
        },
      };
      throw response;
    }
  }

  static async listTrackersForRecentProject(
    projectPath: string,
  ): Promise<TrackerRepo[]> {
    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const storage = await TrackerRepoStorage.createByProjectPath(
      projectPath,
      globalConfig,
    );
    const main = storage.getTrackerRepo();
    const subTrackers = await TrackerRepoStorage.findSubTrackerRepos(
      main.projectPath,
      globalConfig,
    );
    return [main, ...subTrackers];
  }

  static async findTrackersContainingPath(
    resolvedPath: string,
    recentProjects: RecentProjectItem[],
  ): Promise<TrackerRepo[]> {
    const fileService = FileService.getInstance();
    const matches: TrackerRepo[] = [];
    const seenProjectPaths = new Set<string>();

    for (const recent of recentProjects) {
      const absProject = path.resolve(recent.projectPath);
      if (seenProjectPaths.has(absProject)) {
        continue;
      }
      seenProjectPaths.add(absProject);
      const exists = await fileService.exists(absProject).catch(() => false);
      if (!exists) {
        continue;
      }
      try {
        const trackers =
          await ViewPathResolverHelper.listTrackersForRecentProject(absProject);
        for (const tracker of trackers) {
          if (
            ViewPathResolverHelper.isPathUnderTrackerPath(
              resolvedPath,
              tracker.trackerPath,
            )
          ) {
            matches.push(tracker);
          }
        }
      } catch {
        // skip unloadable recent project
      }
    }
    return matches;
  }

  static resolveIssueSelectorFromViewPath(
    resolvedPath: string,
    options: { isDirectory: boolean },
  ): string | null {
    if (options.isDirectory) {
      const selector = path.basename(resolvedPath);
      return ViewPathResolverHelper.isIssueSelectorPathSegment(selector)
        ? selector
        : null;
    }
    let current = path.dirname(resolvedPath);
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      const selector = path.basename(current);
      if (ViewPathResolverHelper.isIssueSelectorPathSegment(selector)) {
        return selector;
      }
      current = parent;
    }
  }

  static async resolveIssueFromViewPath(
    resolvedPath: string,
    findIssue: (selector: string) => Promise<IssueFolder[]>,
  ): Promise<IssueFolder | null> {
    const fileService = FileService.getInstance();
    let isDirectory: boolean;
    try {
      const stat = await fileService.stat(resolvedPath);
      isDirectory = stat.isDirectory();
    } catch {
      return null;
    }
    const selector = ViewPathResolverHelper.resolveIssueSelectorFromViewPath(
      resolvedPath,
      { isDirectory },
    );
    if (selector === null) {
      return null;
    }
    const folders = await findIssue(selector);
    if (folders.length === 0) {
      return null;
    }
    return folders[0]!;
  }

  static async findTrackerRepo(resolvedPath: string): Promise<TrackerRepo[]> {
    const recentProjects =
      await RegistryService.getInstance().getRecentProjects();
    if (recentProjects.length === 0) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "VIEW_PATH_NO_RECENT_PROJECTS",
          message: intl.formatMessage(messages.noRecentProjects),
        },
      };
      throw response;
    }
    return ViewPathResolverHelper.findTrackersContainingPath(
      resolvedPath,
      recentProjects,
    );
  }

  static throwViewPathNotUnderRecentTracker(resolvedPath: string): never {
    const response: ErrorResponse = {
      status: "error",
      error: {
        code: "VIEW_PATH_NOT_UNDER_RECENT_TRACKER",
        message: intl.formatMessage(messages.notUnderRecentTracker),
        details: { path: resolvedPath },
      },
    };
    throw response;
  }

  static formatTrackerPickItem(tracker: TrackerRepo): string {
    return `${path.basename(tracker.projectPath)}  ${tracker.projectPath}`;
  }
}
