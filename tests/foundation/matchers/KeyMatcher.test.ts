import type { Key } from "ink";
import { KeyMatcher } from "../../../src/foundation/matchers/KeyMatcher.ts";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";
import {
  consumeToolbarInput,
  type ToolbarConfigItem,
} from "../../../src/views/components/ToolBar.tsx";

function k(partial: Partial<Key>): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...partial,
  };
}

describe("KeyMatcher", () => {
  it("matches Esc", () => {
    expect(KeyMatcher.match("Esc", "", k({ escape: true }))).toBe(true);
    expect(KeyMatcher.match("Esc", "", k({ escape: false }))).toBe(false);
    expect(KeyMatcher.match("Esc", AnsiEscapeCode.ESC, k({ escape: false }))).toBe(true);
  });

  it("matches Enter", () => {
    expect(KeyMatcher.match("Enter", "", k({ return: true }))).toBe(true);
    expect(KeyMatcher.match("Enter", "", k({ return: false }))).toBe(false);
  });

  it("matches Space", () => {
    expect(KeyMatcher.match("Space", " ", k({}))).toBe(true);
    expect(KeyMatcher.match("Space", "x", k({}))).toBe(false);
    expect(KeyMatcher.match("Space", " ", k({ ctrl: true }))).toBe(false);
  });

  it("matches arrow keys", () => {
    expect(KeyMatcher.match("Up", "", k({ upArrow: true }))).toBe(true);
    expect(KeyMatcher.match("Down", "", k({ downArrow: true }))).toBe(true);
    expect(KeyMatcher.match("Left", "", k({ leftArrow: true }))).toBe(true);
    expect(KeyMatcher.match("Right", "", k({ rightArrow: true }))).toBe(true);
  });

  it("matches c+c", () => {
    expect(KeyMatcher.match("c+c", "c", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+c", "C", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+c", "x", k({ ctrl: true }))).toBe(false);
  });

  it("matches c+r and does not match plain r", () => {
    expect(KeyMatcher.match("c+r", "r", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+r", "R", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+r", "r", k({ ctrl: false }))).toBe(false);
  });

  it("matches c+PgUp and c+PgDn", () => {
    expect(KeyMatcher.match("c+PgUp", "", k({ ctrl: true, pageUp: true }))).toBe(
      true,
    );
    expect(
      KeyMatcher.match("c+PgDn", "", k({ ctrl: true, pageDown: true })),
    ).toBe(true);
    expect(KeyMatcher.match("c+PgUp", "", k({ ctrl: false, pageUp: true }))).toBe(
      false,
    );
    expect(
      KeyMatcher.match("c+PgDn", "", k({ ctrl: true, pageDown: false })),
    ).toBe(false);
  });

  it("matches literal /", () => {
    expect(KeyMatcher.match("/", "/", k({}))).toBe(true);
    expect(KeyMatcher.match("/", "x", k({}))).toBe(false);
  });

  it("matches literal I for Import toolbar shortcut", () => {
    expect(KeyMatcher.match("I", "i", k({}))).toBe(true);
    expect(KeyMatcher.match("I", "I", k({}))).toBe(true);
    expect(KeyMatcher.match("I", "x", k({}))).toBe(false);
  });

  it("does not match plain letter shortcuts when ctrl is held", () => {
    expect(KeyMatcher.match("e", "e", k({ ctrl: true }))).toBe(false);
    expect(KeyMatcher.match("E", "e", k({ ctrl: true }))).toBe(false);
  });

  it("matches c+e and does not match plain e with ctrl", () => {
    expect(KeyMatcher.match("c+e", "e", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+e", "E", k({ ctrl: true }))).toBe(true);
    expect(KeyMatcher.match("c+e", "e", k({ ctrl: false }))).toBe(false);
  });
});

describe("consumeToolbarInput", () => {
  it("invokes first matching item and returns true", () => {
    const calls: string[] = [];
    const items: ToolbarConfigItem[] = [
      {
        label: "A",
        key: "a",
        callback: () => {
          calls.push("a");
        },
      },
      {
        label: "B",
        key: "b",
        callback: () => {
          calls.push("b");
        },
      },
    ];
    expect(consumeToolbarInput(items, "a", k({}))).toBe(true);
    expect(calls).toEqual(["a"]);
  });

  it("skips disabled items", () => {
    const calls: string[] = [];
    const items: ToolbarConfigItem[] = [
      {
        label: "A",
        key: "x",
        isDisabled: true,
        callback: () => {
          calls.push("a");
        },
      },
      {
        label: "B",
        key: "x",
        callback: () => {
          calls.push("b");
        },
      },
    ];
    expect(consumeToolbarInput(items, "x", k({}))).toBe(true);
    expect(calls).toEqual(["b"]);
  });

  it("skips hidden items", () => {
    const calls: string[] = [];
    const items: ToolbarConfigItem[] = [
      {
        label: "A",
        key: "x",
        isHidden: true,
        callback: () => {
          calls.push("a");
        },
      },
      {
        label: "B",
        key: "x",
        callback: () => {
          calls.push("b");
        },
      },
    ];
    expect(consumeToolbarInput(items, "x", k({}))).toBe(true);
    expect(calls).toEqual(["b"]);
  });

  it("consumes c+PgUp toolbar item", () => {
    const calls: string[] = [];
    const items: ToolbarConfigItem[] = [
      {
        label: "Prev",
        key: "c+PgUp",
        callback: () => {
          calls.push("prev");
        },
      },
    ];
    expect(consumeToolbarInput(items, "", k({ ctrl: true, pageUp: true }))).toBe(
      true,
    );
    expect(calls).toEqual(["prev"]);
  });

  it("invokes c+e before plain e when ctrl is held", () => {
    const calls: string[] = [];
    const items: ToolbarConfigItem[] = [
      {
        label: "Edit",
        key: "e",
        callback: () => {
          calls.push("edit");
        },
      },
      {
        label: "External Edit",
        key: "c+e",
        callback: () => {
          calls.push("externalEdit");
        },
      },
    ];
    expect(consumeToolbarInput(items, "e", k({ ctrl: true }))).toBe(true);
    expect(calls).toEqual(["externalEdit"]);
  });
});
