import { describe, expect, it } from "@jest/globals";
import { accessToolbarConfigList } from "../../src/types/Toolbar.ts";
import type { ToolbarConfigItem } from "../../src/types/Toolbar.ts";

describe("accessToolbarConfigList", () => {
  const base: ToolbarConfigItem[] = [
    {
      label: "Quit",
      key: "c+c",
      callback: () => {},
      description: "Leave",
      showInHelpDialog: false,
    },
    {
      label: "Hidden",
      key: "x",
      callback: () => {},
      isHidden: true,
    },
    {
      label: "Search",
      key: "/",
      callback: () => {},
      description: "Find issues",
    },
  ];

  it("excludes hidden and showInHelpDialog false entries", () => {
    expect(accessToolbarConfigList(base).filterForHelp("")).toHaveLength(1);
    expect(accessToolbarConfigList(base).filterForHelp("")[0]!.label).toBe(
      "Search",
    );
  });

  it("filters by substring on key label or description", () => {
    expect(accessToolbarConfigList(base).filterForHelp("find")).toHaveLength(1);
    expect(accessToolbarConfigList(base).filterForHelp("nomatch")).toHaveLength(
      0,
    );
  });
});
