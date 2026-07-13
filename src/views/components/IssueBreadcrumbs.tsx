import React, { useMemo } from "react";
import { Text } from "ink";
import stringWidth from "string-width";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { useAppStore } from "../../store/AppStore.ts";
import type { IssueViewerPage, Page } from "../../types/page.ts";
import { DefaultTheme } from "../../types/Theme.ts";

const MAX_PREVIOUS_IDS = 2;
const PREV_SEPARATOR = " > ";
const TITLE_SEPARATOR = ":";

export type IssueBreadcrumbsProps = {
  title: string;
  width: number;
};

function isIssueViewerPage(page: Page): page is IssueViewerPage {
  return page.name === "ISSUE_VIEWER";
}

export function IssueBreadcrumbs({ title, width }: IssueBreadcrumbsProps) {
  const navigationStack = useAppStore((s) => s.navigationStack);

  const { previousIds, currentId, displayTitle } = useMemo(() => {
    const viewerPages = navigationStack.filter(isIssueViewerPage);
    const current = viewerPages[viewerPages.length - 1];
    const previous = viewerPages.slice(
      Math.max(0, viewerPages.length - 1 - MAX_PREVIOUS_IDS),
      Math.max(0, viewerPages.length - 1),
    );
    const currentIssueId = current?.args.issue.issueId ?? "";
    const previousIssueIds = previous.map((page) => page.args.issue.issueId);

    let prefix = "";
    for (const id of previousIssueIds) {
      if (prefix !== "") {
        prefix += PREV_SEPARATOR;
      }
      prefix += id;
    }
    if (previousIssueIds.length > 0 && currentIssueId !== "") {
      prefix += PREV_SEPARATOR;
    }
    prefix += currentIssueId;

    const trimmedTitle = title.trim();
    const showTitle = trimmedTitle !== "" && currentIssueId !== "";
    if (showTitle) {
      prefix += TITLE_SEPARATOR;
    }

    const titleBudget = Math.max(0, width - stringWidth(prefix));
    const truncatedTitle = showTitle
      ? BasicLayouter.stringWidthTruncateEnd(trimmedTitle, titleBudget)
      : "";

    return {
      previousIds: previousIssueIds,
      currentId: currentIssueId,
      displayTitle: truncatedTitle,
    };
  }, [navigationStack, title, width]);

  if (currentId === "") {
    return null;
  }

  const showTitle = displayTitle !== "";

  return (
    <>
      {previousIds.map((id, index) => (
        <React.Fragment key={`${index}-${id}`}>
          {index > 0 ? (
            <Text color={DefaultTheme.accents.green}>{PREV_SEPARATOR}</Text>
          ) : null}
          <Text bold color={DefaultTheme.accents.orange}>
            {id}
          </Text>
        </React.Fragment>
      ))}
      {previousIds.length > 0 ? (
        <Text color={DefaultTheme.accents.green}>{PREV_SEPARATOR}</Text>
      ) : null}
      <Text bold color={DefaultTheme.accents.orange}>
        {currentId}
      </Text>
      {showTitle ? (
        <>
          <Text color={DefaultTheme.accents.green}>{TITLE_SEPARATOR}</Text>
          <Text bold color={DefaultTheme.accents.orange}>
            {displayTitle}
          </Text>
        </>
      ) : null}
    </>
  );
}
