import { useMemo } from "react";
import { useInput, Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { TextLayouter } from "../../foundation/layouter/TextLayouter.ts";
import {
  mediumDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { ToolBar, type ToolbarConfigItem } from "./ToolBar.tsx";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import {
  EMPTY_AREA_EXTRA,
  EMPTY_AREA_SIDE_MARGIN,
  EmptyArea,
} from "./EmptyArea.tsx";

const CONFIRMATION_DIALOG_HEIGHT = 7;
const messages = defineMessages({
  cancel: {
    id: "views.confirmationDialog.cancel",
    defaultMessage: "Cancel",
  },
  confirm: {
    id: "views.confirmationDialog.confirm",
    defaultMessage: "Confirm",
  },
});

export function ConfirmationDialog() {
  const intl = useIntl();
  const isDialogOpen = useConfirmationDialogStore((s) => s.isDialogOpen);
  const title = useConfirmationDialogStore((s) => s.title);
  const message = useConfirmationDialogStore((s) => s.message);
  const confirmLabel = useConfirmationDialogStore((s) => s.confirmLabel);
  const variant = useConfirmationDialogStore((s) => s.variant);
  const ctrlCToConfirm = useConfirmationDialogStore((s) => s.ctrlCToConfirm);
  const close = useConfirmationDialogStore((s) => s.close);
  const confirm = useConfirmationDialogStore((s) => s.confirm);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.ConfirmationDialog;

  const { width, height, left, top } = useDialogLayout({
    ...mediumDialogLayout,
    minHeight: CONFIRMATION_DIALOG_HEIGHT,
    maxHeight: CONFIRMATION_DIALOG_HEIGHT,
  });
  const messageWidth = Math.max(1, width - 4);
  const messageLines = useMemo((): [string, string] => {
    const layouter = new TextLayouter();
    layouter.setContent([message]);
    const wrapped = layouter.layout(messageWidth, 0).formattedContent;
    if (wrapped.length <= 2) {
      return [wrapped[0] ?? "", wrapped[1] ?? ""];
    }
    return [
      wrapped[0]!,
      BasicLayouter.stringWidthTruncateEnd(
        wrapped.slice(1).join(""),
        messageWidth,
      ),
    ];
  }, [message, messageWidth]);
  const displayMessage = useMemo(
    () =>
      [
        BasicLayouter.stringWidthPadEnd(messageLines[0], messageWidth),
        BasicLayouter.stringWidthPadEnd(messageLines[1], messageWidth),
      ].join("\n"),
    [messageLines, messageWidth],
  );

  const confirmAccentColor =
    variant === "destructive"
      ? DefaultTheme.accents.red
      : DialogConfirmColor;
  const borderColor =
    variant === "destructive"
      ? DefaultTheme.accents.red
      : DefaultTheme.accents.green;

  const toolbarItems = useMemo<ToolbarConfigItem[]>(
    () => [
      {
        label: intl.formatMessage(messages.cancel),
        key: "Esc",
        callback: close,
      },
      {
        label: confirmLabel ?? intl.formatMessage(messages.confirm),
        key: "Enter",
        callback: confirm,
        color: confirmAccentColor,
      },
    ],
    [close, confirm, confirmAccentColor, confirmLabel, intl],
  );

  useInput(
    (input, key) => {
      if (!isDialogOpen) return;
      if (ctrlCToConfirm && key.ctrl && input === "c") {
        confirm();
        return;
      }
    },
    { isActive: isDialogOpen && isLatestPopup },
  );

  if (!isDialogOpen) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={Math.max(0, left - EMPTY_AREA_SIDE_MARGIN)}
      marginTop={Math.max(0, top - EMPTY_AREA_SIDE_MARGIN)}
      width={width + EMPTY_AREA_EXTRA}
      height={height + EMPTY_AREA_EXTRA}
    >
      <Box
        flexDirection="column"
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={width}
        height={height}
        borderStyle="single"
        borderColor={borderColor}
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={1}
        paddingTop={0}
        paddingBottom={1}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color={DefaultTheme.accents.orange}>{title}</Text>
        </Box>
        <Box marginTop={1} height={2} width={messageWidth}>
          <Text>{displayMessage}</Text>
        </Box>
        <Box marginTop={2} justifyContent="flex-end">
          <ToolBar
            width={width - 2}
            items={toolbarItems}
            isDisabled={!isDialogOpen || !isLatestPopup}
          />
        </Box>
      </Box>
    </EmptyArea>
  );
}
