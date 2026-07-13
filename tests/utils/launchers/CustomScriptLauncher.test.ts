import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { FileService } from "../../../src/services/FileService.ts";
import { LoggerService } from "../../../src/services/LoggerService.ts";
import { ShellService } from "../../../src/services/ShellService.ts";
import type { CustomScriptEntry } from "../../../src/types/CustomScript.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { CustomScriptLauncher } from "../../../src/utils/launchers/CustomScriptLauncher.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

describe("CustomScriptLauncher", () => {
  const repo: TrackerRepo = {
    name: "proj",
    projectPath: "/repo",
    trackerPath: "/repo/issues",
    config: {},
  };

  afterEach(() => {
    ShellService.setInstance(null);
    FileService.setInstance(null);
    LoggerService.setInstance(new LoggerService());
  });

  describe("formatRunLine", () => {
    it("joins command and args for display", () => {
      const launcher = new CustomScriptLauncher();
      expect(launcher.formatRunLine("vim", ["$MUD_ISSUE_ID"])).toBe(
        "vim $MUD_ISSUE_ID",
      );
    });
  });

  describe("validateExecutable", () => {
    beforeEach(() => {
      ShellService.setInstance({
        isAbsolute: jest.fn(() => false),
        which: jest.fn(async () => "/usr/bin/vim"),
      } as unknown as ShellService);
      FileService.setInstance({
        isExecutable: jest.fn(async () => true),
      } as unknown as FileService);
    });

    it("returns null when the command is found on PATH", async () => {
      const launcher = new CustomScriptLauncher();
      await expect(launcher.validateExecutable("vim")).resolves.toBeNull();
    });

    it("returns an error when the command is missing", async () => {
      ShellService.setInstance({
        isAbsolute: jest.fn(() => false),
        which: jest.fn(async () => null),
      } as unknown as ShellService);
      const launcher = new CustomScriptLauncher();

      await expect(launcher.validateExecutable("missing-cmd")).resolves.toBe(
        "Script command not found: missing-cmd",
      );
    });
  });

  describe("run", () => {
    let writeFileMock: jest.Mock<FileService["writeFile"]>;
    let chmodMock: jest.Mock<FileService["chmod"]>;
    let rmMock: jest.Mock<FileService["rm"]>;
    let runAndWaitMock: jest.Mock<ShellService["runAndWait"]>;
    let debugMock: jest.Mock<LoggerService["debug"]>;

    beforeEach(() => {
      writeFileMock = jest.fn(async () => undefined);
      chmodMock = jest.fn(async () => undefined);
      rmMock = jest.fn(async () => undefined);
      runAndWaitMock = jest.fn(() => ({ status: 0 }));
      debugMock = jest.fn();

      FileService.setInstance({
        isExecutable: jest.fn(async () => true),
        writeFile: writeFileMock,
        chmod: chmodMock,
        rm: rmMock,
      } as unknown as FileService);

      ShellService.setInstance({
        isAbsolute: jest.fn(() => false),
        which: jest.fn(async () => "/usr/bin/vim"),
        tmpdir: jest.fn(() => "/tmp"),
        runAndWait: runAndWaitMock,
      } as unknown as ShellService);

      LoggerService.setInstance({
        debug: debugMock,
      } as unknown as LoggerService);
    });

    it("writes a temp shell script that expands env-referenced args", async () => {
      const launcher = new CustomScriptLauncher();
      const script: CustomScriptEntry = {
        name: "Open Primary Issue",
        command: "vim",
        args: ["$MUD_ISSUE_ID"],
      };
      const issues = [buildIssueFolder("MIA0001")];

      await launcher.run(script, issues, repo);

      expect(writeFileMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/mudissue-custom-script-/),
        `#!/bin/sh
vim $MUD_ISSUE_ID
`,
        "utf-8",
      );
      expect(chmodMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/mudissue-custom-script-/),
        0o700,
      );
      expect(runAndWaitMock).toHaveBeenCalledWith(
        "/bin/sh",
        [expect.stringMatching(/^\/tmp\/mudissue-custom-script-/)],
        {
          cwd: "/repo",
          env: expect.objectContaining({
            MUD_ISSUE_IDS: "MIA0001",
            MUD_ISSUE_ID: "MIA0001",
            MUD_PROJECT_PATH: "/repo",
            MUD_TRACKER_PATH: "/repo/issues",
          }),
        },
      );
      expect(rmMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/mudissue-custom-script-/),
      );
    });

    it("quotes only tokens that contain spaces in the temp shell script", async () => {
      const launcher = new CustomScriptLauncher();
      const script: CustomScriptEntry = {
        name: "Archive Issues",
        command: "/bin/archive.sh",
        args: ["--project", "$MUD_PROJECT_PATH", "--files", "$MUD_ISSUE_IDS"],
      };
      const issues = [buildIssueFolder("MIA0001"), buildIssueFolder("MIA0002")];

      await launcher.run(script, issues, repo);

      expect(writeFileMock).toHaveBeenCalledWith(
        expect.any(String),
        `#!/bin/sh
/bin/archive.sh --project $MUD_PROJECT_PATH --files $MUD_ISSUE_IDS
`,
        "utf-8",
      );
    });

    it("double-quotes tokens that contain spaces", async () => {
      const launcher = new CustomScriptLauncher();
      const script: CustomScriptEntry = {
        name: "Open file",
        command: "vim",
        args: ["$MUD_ISSUE_ID with spaces"],
      };
      const issues = [buildIssueFolder("MIA0001")];

      await launcher.run(script, issues, repo);

      expect(writeFileMock).toHaveBeenCalledWith(
        expect.any(String),
        `#!/bin/sh
vim "$MUD_ISSUE_ID with spaces"
`,
        "utf-8",
      );
    });

    it("keeps the temp script and logs its path when debug is enabled", async () => {
      const launcher = new CustomScriptLauncher();
      const script: CustomScriptEntry = {
        name: "Open Primary Issue",
        command: "vim",
        args: ["$MUD_ISSUE_ID"],
      };
      const issues = [buildIssueFolder("MIA0001")];

      await launcher.run(script, issues, repo, { debug: true });

      const scriptPath = writeFileMock.mock.calls[0]?.[0];
      expect(typeof scriptPath).toBe("string");
      expect(debugMock).toHaveBeenCalledWith(
        `Custom script wrapper: ${scriptPath}`,
      );
      expect(rmMock).not.toHaveBeenCalled();
    });
  });
});
