import { jest } from "@jest/globals";
import { CustomScriptPaletteHelper } from "../../src/helpers/CustomScriptPaletteHelper.ts";
import { InlinePressAnyKeyHelper } from "../../src/helpers/InlinePressAnyKeyHelper.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import {
  resetReactSessionStore,
  useReactSessionStore,
} from "../../src/store/ReactSessionStore.ts";
import { useConfirmationDialogStore } from "../../src/store/ConfirmationDialogStore.ts";
import { useAlertDialogStore } from "../../src/store/AlertDialogStore.ts";
import type { CustomScriptEntry } from "../../src/types/CustomScript.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  accessPaletteCommandList,
  type PaletteCommand,
} from "../../src/types/PaletteCommand.ts";
import { CustomScriptLauncher } from "../../src/utils/launchers/CustomScriptLauncher.ts";
import {
  PaletteCommandRegistry,
  PaletteCommandRegistryScope,
} from "../../src/views/PaletteCommands/PaletteCommandRegistry.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo/tracker",
  config: {
    issue_path: "issues",
    scripts: [
      {
        name: "Open in Vim",
        description: "Edit issue in Vim",
        command: "vim",
        args: ["$MUD_ISSUE_ID"],
      },
      {
        name: "Open Shell",
        command: "sh",
      },
    ],
  },
};

const sampleScripts: CustomScriptEntry[] = mockRepo.config.scripts ?? [];

describe("CustomScriptPaletteHelper", () => {
  describe("buildPaletteCommands", () => {
    it("returns an empty list when no scripts are configured", () => {
      const helper = new CustomScriptPaletteHelper();

      expect(helper.buildPaletteCommands([])).toEqual([]);
    });

    it("builds one palette command per script with order-based keys", () => {
      const helper = new CustomScriptPaletteHelper();

      const commands = helper.buildPaletteCommands(sampleScripts);

      expect(commands).toEqual([
        {
          key: "custom-script-1",
          label: "Open in Vim",
          description: "Edit issue in Vim",
          callback: expect.any(Function),
        },
        {
          key: "custom-script-2",
          label: "Open Shell",
          description: "",
          callback: expect.any(Function),
        },
      ]);
    });

    it("keeps unique keys when combined with static registry commands", () => {
      const helper = new CustomScriptPaletteHelper();
      const staticCommands: PaletteCommand[] = [
        ...PaletteCommandRegistry.getPaletteCommands(
          PaletteCommandRegistryScope.IssueTable,
        ),
      ];
      const combined = [
        ...staticCommands,
        ...helper.buildPaletteCommands(sampleScripts),
      ];

      expect(accessPaletteCommandList(combined).hasUniqueKeys()).toBe(true);
    });
  });

  describe("runScript", () => {
    let formatRunLineMock: jest.Mock<CustomScriptLauncher["formatRunLine"]>;
    let validateExecutableMock: jest.Mock<
      CustomScriptLauncher["validateExecutable"]
    >;
    let runMock: jest.Mock<CustomScriptLauncher["run"]>;
    let confirmOpenMock: jest.Mock<
      ReturnType<typeof useConfirmationDialogStore.getState>["open"]
    >;
    let alertOpenMock: jest.Mock<
      ReturnType<typeof useAlertDialogStore.getState>["open"]
    >;
    let suspendMock: jest.Mock<() => Promise<void>>;
    let resumeMock: jest.Mock<() => void>;
    let pressAnyKeyRenderMock: jest.Mock<InlinePressAnyKeyHelper["render"]>;

    beforeEach(() => {
      jest.clearAllMocks();
      resetAppStore();
      resetCurrentTrackerRepoStore();
      resetReactSessionStore();

      suspendMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      resumeMock = jest.fn();
      useReactSessionStore.setState({
        suspend: suspendMock,
        resume: resumeMock,
      });

      formatRunLineMock = jest
        .fn<CustomScriptLauncher["formatRunLine"]>()
        .mockReturnValue("vim $MUD_ISSUE_ID");
      validateExecutableMock = jest
        .fn<CustomScriptLauncher["validateExecutable"]>()
        .mockResolvedValue(null);
      runMock = jest
        .fn<CustomScriptLauncher["run"]>()
        .mockResolvedValue({ exitCode: 0 });

      confirmOpenMock = jest.fn().mockResolvedValue({ type: "accepted" });
      useConfirmationDialogStore.setState({ open: confirmOpenMock });

      alertOpenMock = jest.fn().mockResolvedValue(undefined);
      useAlertDialogStore.setState({ open: alertOpenMock });

      useCurrentTrackerRepoStore.setState({
        getCurrentTrackerRepo: jest.fn().mockResolvedValue(mockRepo),
      });

      useAppStore.setState({
        debug: false,
      });

      pressAnyKeyRenderMock = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      resetAppStore();
      resetCurrentTrackerRepoStore();
      resetReactSessionStore();
    });

    it("does nothing when no issues are selected", async () => {
      useAppStore.setState({ getSelectedIssues: () => [] });

      const helper = new CustomScriptPaletteHelper(
        {
          formatRunLine: formatRunLineMock,
          validateExecutable: validateExecutableMock,
          run: runMock,
        } as unknown as CustomScriptLauncher,
        { render: pressAnyKeyRenderMock } as unknown as InlinePressAnyKeyHelper,
      );

      await helper.runScript(sampleScripts[0]!);

      expect(confirmOpenMock).not.toHaveBeenCalled();
      expect(suspendMock).not.toHaveBeenCalled();
    });

    it("does not run when confirmation is declined", async () => {
      const issue = buildIssueFolder("0001");
      useAppStore.setState({ getSelectedIssues: () => [issue] });
      confirmOpenMock.mockResolvedValue({ type: "cancelled" });

      const helper = new CustomScriptPaletteHelper(
        {
          formatRunLine: formatRunLineMock,
          validateExecutable: validateExecutableMock,
          run: runMock,
        } as unknown as CustomScriptLauncher,
        { render: pressAnyKeyRenderMock } as unknown as InlinePressAnyKeyHelper,
      );

      await helper.runScript(sampleScripts[0]!);

      expect(confirmOpenMock).toHaveBeenCalled();
      expect(suspendMock).not.toHaveBeenCalled();
      expect(runMock).not.toHaveBeenCalled();
    });

    it("shows an alert when the executable is invalid", async () => {
      const issue = buildIssueFolder("0001");
      useAppStore.setState({ getSelectedIssues: () => [issue] });
      validateExecutableMock.mockResolvedValue("Command not found: missing");

      const helper = new CustomScriptPaletteHelper(
        {
          formatRunLine: formatRunLineMock,
          validateExecutable: validateExecutableMock,
          run: runMock,
        } as unknown as CustomScriptLauncher,
        { render: pressAnyKeyRenderMock } as unknown as InlinePressAnyKeyHelper,
      );

      await helper.runScript(sampleScripts[0]!);

      expect(alertOpenMock).toHaveBeenCalled();
      expect(suspendMock).not.toHaveBeenCalled();
      expect(runMock).not.toHaveBeenCalled();
    });

    it("runs the script after suspending the session when confirmed", async () => {
      const issue = buildIssueFolder("0001", {
        label: "0001-test",
        path: "/repo/issues/0001-test",
      });
      useAppStore.setState({ getSelectedIssues: () => [issue] });
      const stdoutWriteSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      const helper = new CustomScriptPaletteHelper(
        {
          formatRunLine: formatRunLineMock,
          validateExecutable: validateExecutableMock,
          run: runMock,
        } as unknown as CustomScriptLauncher,
        { render: pressAnyKeyRenderMock } as unknown as InlinePressAnyKeyHelper,
      );

      await helper.runScript(sampleScripts[0]!);

      expect(confirmOpenMock).toHaveBeenCalled();
      expect(suspendMock).toHaveBeenCalled();
      expect(runMock).toHaveBeenCalledWith(
        sampleScripts[0],
        [issue],
        mockRepo,
        { debug: false },
      );
      expect(pressAnyKeyRenderMock).toHaveBeenCalled();
      expect(resumeMock).toHaveBeenCalled();
      expect(stdoutWriteSpy).toHaveBeenCalledWith("Running vim $MUD_ISSUE_ID\n");

      stdoutWriteSpy.mockRestore();
    });
  });
});
