import {
  CustomScriptEntrySchema,
  CustomScriptsSchema,
} from "../../src/types/CustomScript.ts";
import { TrackerRepoConfigSchema } from "../../src/types/Tracker.ts";

describe("CustomScriptEntrySchema", () => {
  it("accepts a script without description", () => {
    expect(
      CustomScriptEntrySchema.parse({
        name: "Open Primary Issue",
        command: "vim",
      }),
    ).toEqual({
      name: "Open Primary Issue",
      command: "vim",
    });
  });

  it("accepts null or empty description", () => {
    expect(
      CustomScriptEntrySchema.parse({
        name: "Archive Issues",
        description: null,
        command: "/bin/archive.sh",
      }),
    ).toEqual({
      name: "Archive Issues",
      description: null,
      command: "/bin/archive.sh",
    });

    expect(
      CustomScriptEntrySchema.parse({
        name: "Archive Issues",
        description: "",
        command: "/bin/archive.sh",
      }),
    ).toEqual({
      name: "Archive Issues",
      description: "",
      command: "/bin/archive.sh",
    });
  });

  it("accepts description and optional args", () => {
    expect(
      CustomScriptEntrySchema.parse({
        name: "Open Primary Issue",
        description: "Opens the first selected issue in Vim",
        command: "vim",
        args: ["$MUD_ISSUE_ID"],
      }),
    ).toEqual({
      name: "Open Primary Issue",
      description: "Opens the first selected issue in Vim",
      command: "vim",
      args: ["$MUD_ISSUE_ID"],
    });
  });

  it("rejects missing name or command", () => {
    expect(
      CustomScriptEntrySchema.safeParse({
        command: "vim",
      }).success,
    ).toBe(false);

    expect(
      CustomScriptEntrySchema.safeParse({
        name: "Open Primary Issue",
      }).success,
    ).toBe(false);
  });
});

describe("CustomScriptsSchema", () => {
  it("accepts scripts arrays with and without descriptions", () => {
    expect(
      CustomScriptsSchema.parse([
        { name: "Open Primary Issue", command: "vim" },
        {
          name: "Archive Issues",
          description: "Archives selected issues",
          command: "/bin/archive.sh",
        },
      ]),
    ).toEqual([
      { name: "Open Primary Issue", command: "vim" },
      {
        name: "Archive Issues",
        description: "Archives selected issues",
        command: "/bin/archive.sh",
      },
    ]);
  });
});

describe("TrackerRepoConfigSchema scripts", () => {
  it("accepts mud.conf scripts without description", () => {
    expect(
      TrackerRepoConfigSchema.parse({
        scripts: [{ name: "Open Primary Issue", command: "vim" }],
      }),
    ).toEqual({
      scripts: [{ name: "Open Primary Issue", command: "vim" }],
    });
  });
});
