import {
  INITIAL_NAVIGATION_STACK,
  type NavigationStack,
} from "../../src/types/navigation.ts";
import { ISSUE_TABLE_PAGE } from "../../src/types/page.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";

export function viewerNavigationStack(
  issue: IssueFolder,
  project?: string,
): NavigationStack {
  return stackedViewerNavigationStack([issue], project);
}

/** ISSUE_TABLE followed by one ISSUE_VIEWER page per issue (order preserved). */
export function stackedViewerNavigationStack(
  issues: IssueFolder[],
  project?: string,
): NavigationStack {
  return [
    ISSUE_TABLE_PAGE,
    ...issues.map((issue) => ({
      name: "ISSUE_VIEWER" as const,
      args: {
        issue,
        ...(project !== undefined ? { project } : {}),
      },
    })),
  ];
}

export { INITIAL_NAVIGATION_STACK };
