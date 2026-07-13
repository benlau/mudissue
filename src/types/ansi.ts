export enum AnsiEscapeCode {
  /** ESC control character (keyboard input) */
  ESC = "\u001b",

  /** DEC private mode: enter alternate screen buffer */
  ENTER_ALTERNATE_SCREEN = "\x1B[?1049h",
  /** DEC private mode: exit alternate screen buffer */
  EXIT_ALTERNATE_SCREEN = "\x1B[?1049l",

  /** DECTCEM: show cursor */
  SHOW_CURSOR = "\x1B[?25h",
  /** DECTCEM: hide cursor */
  HIDE_CURSOR = "\x1B[?25l",

  /** OSC 2: set window title (prefix; append title + BEL) */
  OSC_SET_WINDOW_TITLE_PREFIX = "\x1b]2;",
  /** OSC string terminator (bell) */
  BEL = "\x07",

  /** CSI B: cursor down (arrow key input) */
  CURSOR_DOWN = "\x1b[B",
  /** CSI 4~: delete key input */
  DELETE = "\x1b[4~",
}
