import { useInput, Box, Text } from "ink";
import { useDialogLayout } from "../hooks/useDialogLayout.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { DefaultTheme } from "../../types/Theme.ts";
import {
  EMPTY_AREA_EXTRA,
  EMPTY_AREA_SIDE_MARGIN,
  EmptyArea,
} from "./EmptyArea.tsx";

const ALERT_DIALOG_MIN_WIDTH = 44;
const ALERT_DIALOG_HEIGHT = 5;

export function AlertDialog() {
  const isDialogOpen = useAlertDialogStore((s) => s.isDialogOpen);
  const message = useAlertDialogStore((s) => s.message);
  const close = useAlertDialogStore((s) => s.close);
  const { width, height, left, top } = useDialogLayout({
    minWidth: ALERT_DIALOG_MIN_WIDTH + EMPTY_AREA_EXTRA,
    minHeight: ALERT_DIALOG_HEIGHT + EMPTY_AREA_EXTRA,
  });
  const borderedWidth = width - EMPTY_AREA_EXTRA;
  const borderedHeight = height - EMPTY_AREA_EXTRA;
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.AlertDialog;

  useInput((_input, _key) => {
    close();
  }, { isActive: isDialogOpen && isLatestPopup });

  if (!isDialogOpen) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={left}
      marginTop={top}
      width={width}
      height={height}
    >
      <Box
        flexDirection="column"
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={borderedWidth}
        height={borderedHeight}
        borderStyle="single"
        borderColor={DefaultTheme.accents.green}
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={1}
        paddingTop={0}
        paddingBottom={1}
      >
        <Box>
          <Text>{message}</Text>
        </Box>
        <Box marginTop={2}>
          <Text dimColor>Press any key to close</Text>
        </Box>
      </Box>
    </EmptyArea>
  );
}
