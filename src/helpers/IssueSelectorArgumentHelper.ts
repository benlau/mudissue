import { CurrentIssueResolverHelper } from "./CurrentIssueResolverHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { ErrorResponse } from "../types/Response.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import { IssueFolderValidator } from "../async/validators/IssueFolderValidator.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";

export type IssueSelectorArgumentResult = {
  repo: TrackerRepo;
  issue: IssueFolder;
};

export class IssueSelectorArgumentHelper {
  static async processIssueSelectorArgument(
    issueSelector: string,
    project?: string,
  ): Promise<IssueSelectorArgumentResult> {
    let repo: TrackerRepo | undefined;
    if (project) {
      repo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    }

    let issue: IssueFolder;
    if (CurrentIssueResolverHelper.isCurrentIssueSelector(issueSelector)) {
      issue = await CurrentIssueResolverHelper.resolveCurrentIssue();
    } else {
      const folders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(issueSelector, {
          project,
        });
      issue = new IssueFolderValidator()
        .set(folders)
        .validateIssueNotNone()
        .validateIssueNotMultiple()
        .first();
    }

    if (!repo) {
      repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
    }
    if (!repo) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "ISSUE_NOT_FOUND",
          message: "No issue found for the issue selector",
        },
      };
      throw response;
    }
    return { repo, issue };
  }
}
