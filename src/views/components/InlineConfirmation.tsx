import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { AnsiEscapeCode } from "../../types/ansi.ts";

export type InlineConfirmationProps = {
  message: string;
  onSelect: (value: boolean) => void;
};

export function InlineConfirmation(props: InlineConfirmationProps) {
  const [selected, setSelected] = useState<"no" | "yes">("no");

  useInput((input, key) => {
    if (key.leftArrow) {
      setSelected("no");
      return;
    }
    if (key.rightArrow) {
      setSelected("yes");
      return;
    }
    if (key.escape || input === AnsiEscapeCode.ESC) {
      props.onSelect(false);
      return;
    }
    if (input.toLowerCase() === "y") {
      props.onSelect(true);
      return;
    }
    if (input.toLowerCase() === "n" || (key.ctrl && input === "c")) {
      props.onSelect(false);
      return;
    }
    if (key.return) {
      props.onSelect(selected === "yes");
    }
  });

  return (
    <Box>
      <Text>{props.message} </Text>
      <Text inverse={selected === "no"}> No </Text>
      <Text> </Text>
      <Text inverse={selected === "yes"}> Yes </Text>
    </Box>
  );
}
