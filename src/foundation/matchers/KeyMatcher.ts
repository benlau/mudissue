import type { Key } from "ink";
import { AnsiEscapeCode } from "../../types/ansi.ts";

/**
 * Matches compact shortcut strings against Ink keyboard input.
 * Notation: c+ = Ctrl, Esc/Enter/Up/Down/Left/Right/PgUp/PgDn for special keys.
 */
export class KeyMatcher {
  static match(configKey: string, input: string, inkKey: Key): boolean {
    const ck = configKey.trim();
    if (ck.length === 0) return false;

    const ctrlMatch = /^c\+(.+)$/i.exec(ck);
    if (ctrlMatch) {
      if (inkKey.ctrl !== true) return false;
      return KeyMatcher.matchSpecialOrChar(
        ctrlMatch[1]!.trim(),
        input,
        inkKey,
        true,
      );
    }

    return KeyMatcher.matchSpecialOrChar(ck, input, inkKey, false);
  }

  private static matchSpecialOrChar(
    keyPart: string,
    input: string,
    inkKey: Key,
    isCtrlCompound: boolean,
  ): boolean {
    const upper = keyPart.toUpperCase();

    if (upper === "ESC" || upper === "ESCAPE") {
      return inkKey.escape === true || input === AnsiEscapeCode.ESC;
    }
    if (upper === "ENTER" || upper === "RETURN") return inkKey.return === true;
    if (upper === "SPACE") {
      if (inkKey.ctrl || inkKey.meta || inkKey.super) return false;
      return input === " ";
    }
    if (upper === "UP") return inkKey.upArrow === true;
    if (upper === "DOWN") return inkKey.downArrow === true;
    if (upper === "LEFT") return inkKey.leftArrow === true;
    if (upper === "RIGHT") return inkKey.rightArrow === true;
    if (upper === "PGUP" || upper === "PAGEUP") return inkKey.pageUp === true;
    if (upper === "PGDN" || upper === "PAGEDOWN")
      return inkKey.pageDown === true;

    if (keyPart.length === 1) {
      const c = keyPart;
      if (/[a-zA-Z]/.test(c)) {
        if (!isCtrlCompound && (inkKey.ctrl || inkKey.meta || inkKey.super)) {
          return false;
        }
        return input.length === 1 && input.toLowerCase() === c.toLowerCase();
      }
      return input === c;
    }

    return input === keyPart;
  }
}
