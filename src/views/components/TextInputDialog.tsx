import { useState, useEffect, useRef } from "react";
import { useInput, Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useDialogLayout } from "../hooks/useDialogLayout.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";
import {
  EMPTY_AREA_EXTRA,
  EMPTY_AREA_SIDE_MARGIN,
  EmptyArea,
} from "./EmptyArea.tsx";

const DIALOG_MIN_WIDTH = 44;
const DIALOG_HEIGHT = 5;

export type TextInputDialogProps = {
  isOpen: boolean;
  prompt?: string;
  placeholder?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function TextInputDialog({
  isOpen,
  prompt = "Title:",
  placeholder = "",
  onCancel,
  onSubmit,
}: TextInputDialogProps) {
  const [value, setValue] = useState("");
  const { width, height, left, top } = useDialogLayout({
    minWidth: DIALOG_MIN_WIDTH + EMPTY_AREA_EXTRA,
    minHeight: DIALOG_HEIGHT + EMPTY_AREA_EXTRA,
  });
  const borderedWidth = width - EMPTY_AREA_EXTRA;
  const borderedHeight = height - EMPTY_AREA_EXTRA;
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const pushPopup = usePopupStore((s) => s.pushPopup);
  const popPopup = usePopupStore((s) => s.popPopup);
  const didPushPopupRef = useRef(false);
  const isLatestPopup = latestPopup === PopupNames.TextInputDialog;

  useEffect(() => {
    if (isOpen && !didPushPopupRef.current) {
      pushPopup(PopupNames.TextInputDialog);
      didPushPopupRef.current = true;
    }
    if (!isOpen && didPushPopupRef.current) {
      popPopup();
      didPushPopupRef.current = false;
    }
    return () => {
      if (didPushPopupRef.current) {
        popPopup();
        didPushPopupRef.current = false;
      }
    };
  }, [isOpen, popPopup, pushPopup]);

  useEffect(() => {
    if (isOpen) setValue("");
  }, [isOpen]);

  useInput((_input, key) => {
    if (!isOpen) return;
    if (key.escape) {
      onCancel();
    }
  }, { isActive: isOpen && isLatestPopup });

  if (!isOpen) return null;

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
        paddingY={1}
      >
        <Box>
          <Text>{prompt} </Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={(v) => {
              onSubmit(v);
              setValue("");
            }}
            placeholder={placeholder}
            focus={isLatestPopup}
          />
        </Box>
        <Box marginTop={1}>
          <Text color={DialogConfirmColor}>Enter - confirm</Text>
          <Text dimColor>, Esc - cancel</Text>
        </Box>
      </Box>
    </EmptyArea>
  );
}
