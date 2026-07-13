import { useEffect } from "react";
import { useInput, Box, Text } from "ink";
import stringWidth from "string-width";
import { useTerminalSize } from "../hooks/useTerminal.ts";
import { useToastStore, type ToastPosition } from "../../store/ToastStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";

const TOAST_HEIGHT = 3;
const TOAST_MIN_WIDTH = 12;
const TOAST_MARGIN = 1;
/** Border columns (2) + horizontal padding (paddingX={1} × 2). */
const TOAST_CHROME = 4;

function getToastPosition(
  position: ToastPosition,
  terminalWidth: number,
  terminalHeight: number,
  toastWidth: number,
  toastHeight: number,
): { marginLeft: number; marginTop: number } {
  const left = Math.min(TOAST_MARGIN, Math.max(0, terminalWidth - toastWidth));
  const top = Math.min(TOAST_MARGIN, Math.max(0, terminalHeight - toastHeight));
  const right = Math.max(0, terminalWidth - toastWidth - TOAST_MARGIN);
  const bottom = Math.max(0, terminalHeight - toastHeight - TOAST_MARGIN);
  const centerLeft = Math.max(0, Math.floor((terminalWidth - toastWidth) / 2));
  const centerTop = Math.max(0, Math.floor((terminalHeight - toastHeight) / 2));

  switch (position) {
    case "top-left":
      return { marginLeft: left, marginTop: top };
    case "top-middle":
      return { marginLeft: centerLeft, marginTop: top };
    case "bottom-right":
      return { marginLeft: right, marginTop: bottom };
    case "bottom-left":
      return { marginLeft: left, marginTop: bottom };
    case "center":
      return { marginLeft: centerLeft, marginTop: centerTop };
    case "top-right":
    default:
      return { marginLeft: right, marginTop: top };
  }
}

export function Toast() {
  const isToastOpen = useToastStore((s) => s.isToastOpen);
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const duration = useToastStore((s) => s.duration);
  const position = useToastStore((s) => s.position);
  const persistent = useToastStore((s) => s.persistent);
  const toastKey = useToastStore((s) => s.toastKey);
  const close = useToastStore((s) => s.close);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.Toast;
  const size = useTerminalSize();

  useEffect(() => {
    if (!isToastOpen || persistent) return;
    const timer = globalThis.setTimeout(close, duration);
    return () => globalThis.clearTimeout(timer);
  }, [close, duration, isToastOpen, persistent, toastKey]);

  useInput(
    () => {
      close();
    },
    { isActive: isToastOpen && isLatestPopup },
  );

  if (!isToastOpen) return null;

  const maxBorderedWidth = Math.max(1, size.cols - EMPTY_AREA_EXTRA);
  const naturalBorderedWidth = stringWidth(message) + TOAST_CHROME;
  const borderedToastWidth = Math.max(
    1,
    Math.min(
      maxBorderedWidth,
      Math.max(TOAST_MIN_WIDTH, naturalBorderedWidth),
    ),
  );
  const emptyAreaWidth = borderedToastWidth + EMPTY_AREA_EXTRA;
  const emptyAreaHeight = TOAST_HEIGHT + EMPTY_AREA_EXTRA;
  const contentWidth = Math.max(0, borderedToastWidth - TOAST_CHROME);
  const displayMessage = BasicLayouter.stringWidthTruncateEnd(
    message,
    contentWidth,
  );
  const { marginLeft, marginTop } = getToastPosition(
    position,
    size.cols,
    size.rows,
    emptyAreaWidth,
    emptyAreaHeight,
  );

  return (
    <EmptyArea
      position="absolute"
      marginLeft={marginLeft}
      marginTop={marginTop}
      width={emptyAreaWidth}
      height={emptyAreaHeight}
    >
      <Box
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={borderedToastWidth}
        height={TOAST_HEIGHT}
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={1}
      >
        <Text color={variant === "error" ? "red" : undefined}>
          {displayMessage}
        </Text>
      </Box>
    </EmptyArea>
  );
}
