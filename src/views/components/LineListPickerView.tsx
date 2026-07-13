import { useCallback, useEffect, useState } from "react";
import { useInput, Box, Text } from "ink";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { clamp } from "../../types/maths.ts";

function clampLineListIndex(index: number, lineCount: number): number {
  if (lineCount <= 0) return 0;
  return clamp(index, 0, lineCount - 1);
}

function ensureScrollShowsSelection(
  scrollOffset: number,
  selectedIndex: number,
  pageSize: number,
  maxLineIndex: number,
): number {
  if (maxLineIndex < 0 || pageSize <= 0) return 0;
  const idx = clamp(selectedIndex, 0, maxLineIndex);
  if (idx < scrollOffset) return idx;
  if (idx >= scrollOffset + pageSize) {
    return Math.max(0, idx - pageSize + 1);
  }
  return scrollOffset;
}

type LineListPickerState = {
  internalIndex: number;
  scrollOffset: number;
};

function createPickerState(
  selectedIndex: number,
  scrollOffset: number,
  lineCount: number,
  pageSize: number,
): LineListPickerState {
  const internalIndex = clampLineListIndex(selectedIndex, lineCount);
  return {
    internalIndex,
    scrollOffset: ensureScrollShowsSelection(
      scrollOffset,
      internalIndex,
      pageSize,
      lineCount - 1,
    ),
  };
}

export type LineListPickerViewProps = {
  lines: string[];
  width: number;
  height: number;
  /** Seeds internal selection when the component mounts. */
  initialSelectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  onSelected?: (index: number) => void;
  isDisabled?: boolean;
};

export function LineListPickerView({
  lines,
  width,
  height,
  initialSelectedIndex = 0,
  onSelectedIndexChange,
  onSelected,
  isDisabled = false,
}: LineListPickerViewProps) {
  const pageSize = Math.max(0, height);
  const [pickerState, setPickerState] = useState<LineListPickerState>(() =>
    createPickerState(initialSelectedIndex, 0, lines.length, pageSize),
  );

  const selectedIndex = clampLineListIndex(
    pickerState.internalIndex,
    lines.length,
  );
  const scrollOffset = pickerState.scrollOffset;

  const applyIndex = useCallback(
    (next: number) => {
      setPickerState((prev) =>
        createPickerState(next, prev.scrollOffset, lines.length, pageSize),
      );
    },
    [lines.length, pageSize],
  );

  useEffect(() => {
    setPickerState((prev) =>
      createPickerState(prev.internalIndex, prev.scrollOffset, lines.length, pageSize),
    );
  }, [lines.length, pageSize]);

  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [selectedIndex, onSelectedIndexChange]);

  const visibleLines = lines.slice(scrollOffset, scrollOffset + pageSize);
  const safeWidth = Math.max(0, width);
  const viewportHeight = pageSize;

  const onInput = useCallback(
    (
      input: string,
      key: {
        upArrow?: boolean;
        downArrow?: boolean;
        pageUp?: boolean;
        pageDown?: boolean;
        home?: boolean;
        end?: boolean;
        return?: boolean;
      },
    ) => {
      if (lines.length === 0) return;

      const maxIndex = lines.length - 1;
      const pageStep =
        pageSize > 0 ? pageSize : Math.max(1, lines.length);

      const baseIndex = clampLineListIndex(
        pickerState.internalIndex,
        lines.length,
      );

      if (key.upArrow) {
        applyIndex(baseIndex - 1);
        return;
      }
      if (key.downArrow) {
        applyIndex(baseIndex + 1);
        return;
      }
      if (key.pageUp) {
        applyIndex(baseIndex - pageStep);
        return;
      }
      if (key.pageDown) {
        applyIndex(baseIndex + pageStep);
        return;
      }
      if (key.home) {
        applyIndex(0);
        return;
      }
      if (key.end) {
        applyIndex(maxIndex);
        return;
      }
      const isEnter = key.return || input === "\r" || input === "\n";
      if (isEnter) {
        onSelected?.(baseIndex);
      }
    },
    [
      applyIndex,
      pageSize,
      pickerState.internalIndex,
      lines.length,
      onSelected,
    ],
  );

  useInput(onInput, { isActive: !isDisabled });

  return (
    <Box flexDirection="column" height={viewportHeight}>
      {visibleLines.map((line, i) => {
        const globalIndex = scrollOffset + i;
        const isSelected = globalIndex === selectedIndex;
        let rendered = line;
        if (safeWidth > 0) {
          rendered = BasicLayouter.stringWidthTruncateEnd(rendered, safeWidth);
        }
        if (safeWidth > 0) {
          rendered = BasicLayouter.stringWidthPadEnd(rendered, safeWidth);
        }
        return (
          <Box key={globalIndex}>
            <Text inverse={isSelected}>{rendered}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
