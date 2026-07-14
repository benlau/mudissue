import {
  INITIAL_NAVIGATION_STACK,
  accessNavigationStack,
} from "../../src/types/navigation.ts";
import { ISSUE_TABLE_PAGE } from "../../src/types/page.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";

function viewerPage(issueId: string) {
  const issue: IssueFolder = {
    issueId,
    label: `${issueId}-sample`,
    path: `/repo/issues/${issueId}-sample`,
  };
  return {
    name: "ISSUE_VIEWER" as const,
    args: { issue },
  };
}

describe("NavigationStackAccessor", () => {
  it("starts at issue table when using default stack", () => {
    const stack = accessNavigationStack().get();

    expect(stack).toEqual(INITIAL_NAVIGATION_STACK);
    expect(accessNavigationStack(stack).getCurrentPage()).toEqual(
      ISSUE_TABLE_PAGE,
    );
    expect(accessNavigationStack(stack).canGoBack()).toBe(false);
  });

  it("push appends a viewer page", () => {
    const stack = accessNavigationStack().push(viewerPage("MI0001")).get();

    expect(stack).toEqual([ISSUE_TABLE_PAGE, viewerPage("MI0001")]);
    expect(accessNavigationStack(stack).getCurrentPage()).toEqual(
      viewerPage("MI0001"),
    );
    expect(accessNavigationStack(stack).canGoBack()).toBe(true);
  });

  it("push builds nested viewer stack", () => {
    const stack = accessNavigationStack()
      .push(viewerPage("MI0001"))
      .push(viewerPage("MI0002"))
      .get();

    expect(stack).toEqual([
      ISSUE_TABLE_PAGE,
      viewerPage("MI0001"),
      viewerPage("MI0002"),
    ]);
  });

  it("pop removes the top page but keeps the table root", () => {
    const stack = accessNavigationStack()
      .push(viewerPage("MI0001"))
      .push(viewerPage("MI0002"))
      .pop()
      .get();

    expect(stack).toEqual([ISSUE_TABLE_PAGE, viewerPage("MI0001")]);
    expect(accessNavigationStack(stack).getCurrentPage()).toEqual(
      viewerPage("MI0001"),
    );
  });

  it("pop is a no-op when only the table root remains", () => {
    const stack = accessNavigationStack().pop().get();

    expect(stack).toEqual(INITIAL_NAVIGATION_STACK);
  });

  it("replaceTop swaps the top page", () => {
    const stack = accessNavigationStack()
      .push(viewerPage("MI0001"))
      .push(viewerPage("MI0002"))
      .replaceTop(viewerPage("MI0003"))
      .get();

    expect(stack).toEqual([
      ISSUE_TABLE_PAGE,
      viewerPage("MI0001"),
      viewerPage("MI0003"),
    ]);
    expect(stack).toHaveLength(3);
  });

  it("resetToTable clears nested viewer stack", () => {
    const stack = accessNavigationStack()
      .push(viewerPage("MI0001"))
      .push(viewerPage("MI0002"))
      .resetToTable()
      .get();

    expect(stack).toEqual(INITIAL_NAVIGATION_STACK);
    expect(accessNavigationStack(stack).getCurrentPage()).toEqual(
      ISSUE_TABLE_PAGE,
    );
  });
});
