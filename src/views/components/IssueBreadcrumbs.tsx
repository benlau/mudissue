import React, { useMemo } from "react";
import * as path from "path";
import { Text } from "ink";
import stringWidth from "string-width";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { useAppStore } from "../../store/AppStore.ts";
import type { IssueViewerPage, Page } from "../../types/page.ts";
import { DefaultTheme } from "../../types/Theme.ts";

const MAX_PREVIOUS_LABELS = 2;
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

  const { previousLabels, currentLabel, displayTitle, isAttachmentView } =
    useMemo(() => {
      const viewerPages = navigationStack.filter(isIssueViewerPage);
      const current = viewerPages[viewerPages.length - 1];
      const previous = viewerPages.slice(
        Math.max(0, viewerPages.length - 1 - MAX_PREVIOUS_LABELS),
        Math.max(0, viewerPages.length - 1),
      );
      const attachmentPath = current?.args.attachmentPath;
      const isAttachment = attachmentPath != null;
      const currentLabel = isAttachment
        ? path.basename(attachmentPath)
        : (current?.args.issue.label ?? "");
      const previousLabels = previous.map((page) => page.args.issue.label);

      let prefix = "";
      for (const label of previousLabels) {
        if (prefix !== "") {
          prefix += PREV_SEPARATOR;
        }
        prefix += label;
      }
      if (previousLabels.length > 0 && currentLabel !== "") {
        prefix += PREV_SEPARATOR;
      }
      prefix += currentLabel;

      const trimmedTitle = title.trim();
      const showTitle =
        !isAttachment && trimmedTitle !== "" && currentLabel !== "";
      if (showTitle) {
        prefix += TITLE_SEPARATOR;
      }

      const titleBudget = Math.max(0, width - stringWidth(prefix));
      const truncatedTitle = showTitle
        ? BasicLayouter.stringWidthTruncateEnd(trimmedTitle, titleBudget)
        : "";

      return {
        previousLabels,
        currentLabel,
        displayTitle: truncatedTitle,
        isAttachmentView: isAttachment,
      };
    }, [navigationStack, title, width]);

  if (currentLabel === "") {
    return null;
  }

  const showTitle = !isAttachmentView && displayTitle !== "";

  return (
    <>
      {previousLabels.map((label, index) => (
        <React.Fragment key={`${index}-${label}`}>
          {index > 0 ? (
            <Text color={DefaultTheme.accents.green}>{PREV_SEPARATOR}</Text>
          ) : null}
          <Text bold color={DefaultTheme.accents.orange}>
            {label}
          </Text>
        </React.Fragment>
      ))}
      {previousLabels.length > 0 ? (
        <Text color={DefaultTheme.accents.green}>{PREV_SEPARATOR}</Text>
      ) : null}
      <Text bold color={DefaultTheme.accents.orange}>
        {currentLabel}
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
