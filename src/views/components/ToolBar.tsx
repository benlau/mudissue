import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Key } from "ink";
import type { ToolbarConfigItem } from "../../types/Toolbar.ts";
import { DefaultTheme } from "../../types/Theme.ts";
import { clamp } from "../../types/maths.ts";
import { KeyMatcher } from "../../foundation/matchers/KeyMatcher.ts";

export type { ToolbarConfigItem };

export function consumeToolbarInput(
  items: ToolbarConfigItem[],
  input: string,
  key: Key,
): boolean {
  for (const item of items) {
    if (item.isHidden) continue;
    if (item.isDisabled) continue;
    if (KeyMatcher.match(item.key, input, key)) {
      item.callback();
      return true;
    }
  }
  return false;
}

export type ToolBarProps = {
  width: number;
  items: ToolbarConfigItem[];
  isDisabled?: boolean;
};

type NormalizedItem = ToolbarConfigItem & {
  displayLabel: string;
  length: number;
};

function buildDisplayItems(items: ToolbarConfigItem[]): NormalizedItem[] {
  return items
    .filter((item) => !item.isHidden)
    .map((item) => {
      const displayLabel =
        item.key.trim() === "" ? item.label : `${item.label}<${item.key}>`;
      return {
        ...item,
        displayLabel,
        length: displayLabel.length,
      };
    });
}

export function ToolBar({
  width,
  items: itemsProp,
  isDisabled = false,
}: ToolBarProps) {
  const items = useMemo(() => buildDisplayItems(itemsProp), [itemsProp]);
  const totalItems = items.length;
  const [startIndex, setStartIndex] = useState(0);

  const safeStartIndex =
    totalItems === 0 ? 0 : clamp(startIndex, 0, totalItems - 1);

  const { visibleItems, canScrollLeft, canScrollRight } = useMemo(() => {
    if (totalItems === 0 || width <= 0) {
      return {
        visibleItems: [] as NormalizedItem[],
        canScrollLeft: false,
        canScrollRight: false,
      };
    }

    const hasLeft = safeStartIndex > 0;
    const remaining = totalItems - safeStartIndex;

    let visibleCount = 0;

    for (let count = 1; count <= remaining; count++) {
      const slice = items
        .slice(safeStartIndex, safeStartIndex + count)
        .map((item) => item.displayLabel);
      const joined = slice.join(" | ");
      const hasRight = safeStartIndex + count < totalItems;

      let content = joined;
      if (hasLeft) {
        content = `< ${content}`;
      }
      if (hasRight) {
        content = `${content} >`;
      }

      if (content.length <= width || count === 1) {
        visibleCount = count;
      } else {
        break;
      }
    }

    if (visibleCount === 0) {
      visibleCount = 1;
    }

    let slice = items.slice(safeStartIndex, safeStartIndex + visibleCount);
    const hasRight = safeStartIndex + visibleCount < totalItems;

    let content = slice.map((item) => item.displayLabel).join(" | ");
    if (safeStartIndex > 0) {
      content = `< ${content}`;
    }
    if (hasRight) {
      content = `${content} >`;
    }

    if (content.length > width && slice.length > 0) {
      const overflow = content.length - width;
      const last = slice[slice.length - 1]!;
      const truncatedLabel = last.displayLabel.slice(
        0,
        Math.max(0, last.displayLabel.length - overflow),
      );
      slice = [
        ...slice.slice(0, -1),
        { ...last, displayLabel: truncatedLabel, length: truncatedLabel.length },
      ];
    }

    return {
      visibleItems: slice,
      canScrollLeft: safeStartIndex > 0,
      canScrollRight: hasRight,
    };
  }, [items, safeStartIndex, totalItems, width]);

  useInput(
    (input, key) => {
      if (consumeToolbarInput(itemsProp, input, key)) {
        return;
      }
      if (totalItems <= 1) {
        return;
      }
      if (key.leftArrow && canScrollLeft) {
        setStartIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow && canScrollRight) {
        setStartIndex((prev) =>
          Math.min(totalItems - 1, prev + 1),
        );
      }
    },
    { isActive: !isDisabled },
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <Box>
      {canScrollLeft ? <Text dimColor={isDisabled}>{"< "}</Text> : null}
      {visibleItems.map((item, index) => (
        <React.Fragment key={`${safeStartIndex + index}-${item.label}`}>
          {index > 0 ? (
            <Text
              dimColor={isDisabled}
              color={isDisabled ? undefined : DefaultTheme.accents.green}
            >
              {" | "}
            </Text>
          ) : null}
          <Text
            dimColor={isDisabled && item.color == null}
            color={isDisabled ? undefined : item.color}
          >
            {item.displayLabel}
          </Text>
        </React.Fragment>
      ))}
      {canScrollRight ? <Text dimColor={isDisabled}>{" >"}</Text> : null}
    </Box>
  );
}
