import { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import { AnsiEscapeCode } from "../../types/ansi.ts";
import { LineListPickerView } from "./LineListPickerView.tsx";
import { useTerminalSize } from "../hooks/useTerminal.ts";

const INLINE_ISSUE_PICKER_MIN_LIST_WIDTH = 20;
const INLINE_ISSUE_PICKER_HORIZONTAL_MARGIN = 2;
const INLINE_ISSUE_PICKER_RESERVED_ROW_COUNT = 3;
const INLINE_ISSUE_PICKER_MIN_LIST_HEIGHT = 1;
const INLINE_ISSUE_PICKER_ISSUE_TITLE_GAP = "  ";

const messages = defineMessages({
  cancelLabel: {
    id: "views.inlineIssuePicker.cancelLabel",
    defaultMessage: "Cancel",
  },
});

export type InlineIssuePickerProps = {
  title: string;
  issues: IssueFolder[];
  onSelect: (issue: IssueFolder | null) => void;
};

export function formatInlineIssuePickerLine(issue: IssueFolder): string {
  const title = issue.metadata?.title?.trim();
  return title
    ? `${issue.issueId}${INLINE_ISSUE_PICKER_ISSUE_TITLE_GAP}${title}`
    : issue.issueId;
}

export function InlineIssuePicker({
  title,
  issues,
  onSelect,
}: InlineIssuePickerProps) {
  const { cols, rows } = useTerminalSize();
  const cancelLabel = intl.formatMessage(messages.cancelLabel);
  const lines = useMemo(
    () => [...issues.map(formatInlineIssuePickerLine), cancelLabel],
    [cancelLabel, issues],
  );
  const maxListHeight = Math.max(
    INLINE_ISSUE_PICKER_MIN_LIST_HEIGHT,
    rows - INLINE_ISSUE_PICKER_RESERVED_ROW_COUNT,
  );
  const listHeight = Math.min(lines.length, maxListHeight);
  const listWidth = Math.max(
    INLINE_ISSUE_PICKER_MIN_LIST_WIDTH,
    cols - INLINE_ISSUE_PICKER_HORIZONTAL_MARGIN,
  );

  useInput((input, key) => {
    if (key.escape || input === AnsiEscapeCode.ESC) {
      onSelect(null);
      return;
    }
    if (key.ctrl && input === "c") {
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{title}</Text>
      <LineListPickerView
        lines={lines}
        width={listWidth}
        height={listHeight}
        onSelected={(index) => {
          if (index >= issues.length) {
            onSelect(null);
          } else {
            onSelect(issues[index] ?? null);
          }
        }}
      />
    </Box>
  );
}
