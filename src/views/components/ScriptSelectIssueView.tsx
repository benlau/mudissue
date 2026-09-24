import { useLayoutEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import { AnsiEscapeCode } from "../../types/ansi.ts";
import { DefaultTheme } from "../../types/Theme.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import { SelectIssueTableHelper } from "../../helpers/SelectIssueTableHelper.ts";
import { LineListPickerView } from "./LineListPickerView.tsx";
import { useTerminalSize } from "../hooks/useTerminal.ts";

const SELECT_ISSUE_RESERVED_ROW_COUNT = 2;
const SELECT_ISSUE_MIN_LIST_HEIGHT = 1;

const messages = defineMessages({
  cancelLabel: {
    id: "views.scriptSelectIssue.cancelLabel",
    defaultMessage: "Cancel",
  },
});

export type ScriptSelectIssueViewProps = {
  title: string;
  issues: IssueFolder[];
  /** Comma-separated property keys replacing default status,priority. */
  columns?: string;
  onSelect: (issue: IssueFolder | null) => void;
};

export function ScriptSelectIssueView({
  title,
  issues,
  columns,
  onSelect,
}: ScriptSelectIssueViewProps) {
  const { cols, rows } = useTerminalSize();
  const cancelLabel = intl.formatMessage(messages.cancelLabel);

  const tableHelper = useMemo(
    () => new SelectIssueTableHelper(columns),
    [columns],
  );
  const tableLayouter = useMemo(() => {
    const layouter = new TableLayouter(tableHelper.getColumnDefs());
    layouter.layout(cols);
    return layouter;
  }, [tableHelper, cols]);

  const headerRow = useMemo(
    () => tableLayouter.makeRow(tableHelper.getHeaderCells()),
    [tableHelper, tableLayouter],
  );

  const issueRows = useMemo(
    () =>
      issues.map((issue) =>
        tableLayouter.makeRow(tableHelper.getRowCells(issue)),
      ),
    [issues, tableHelper, tableLayouter],
  );

  const lines = useMemo(
    () => [...issueRows, cancelLabel],
    [cancelLabel, issueRows],
  );

  const listHeight = Math.max(
    SELECT_ISSUE_MIN_LIST_HEIGHT,
    rows - SELECT_ISSUE_RESERVED_ROW_COUNT,
  );

  useLayoutEffect(() => {
    process.stderr.write(AnsiEscapeCode.ENTER_ALTERNATE_SCREEN);
    return () => {
      process.stderr.write(AnsiEscapeCode.EXIT_ALTERNATE_SCREEN);
    };
  }, []);

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
    <Box flexDirection="column" width={cols} height={rows}>
      <Text>{title}</Text>
      <Box>
        <Text bold color={DefaultTheme.accents.cyan}>
          {headerRow}
        </Text>
      </Box>
      <LineListPickerView
        lines={lines}
        width={cols}
        height={Math.min(lines.length, listHeight)}
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
