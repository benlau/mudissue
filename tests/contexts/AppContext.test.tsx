/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { act, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { AppContextProvider, useEditFile } from "../../src/contexts/AppContext.tsx";
import { resetAppStore } from "../../src/store/AppStore.ts";
import type { IssueSearchStoreState } from "../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../src/store/IssueSearchStore.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../src/views/components/PickItemDialog.tsx";
import { useToastStore } from "../../src/store/ToastStore.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import {
  resetReactSessionStore,
  useReactSessionStore,
} from "../../src/store/ReactSessionStore.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

function resetPickItemDialogStore(): void {
  usePickItemDialogStore.setState({
    isDialogOpen: false,
    items: [],
    getDisplay: String,
    title: "Select item",
    columns: [],
    footerLabel: "Cancel<Esc>",
    minWidth: 52,
    maxWidth: 86,
    geom: {
      dialogWidth: 0,
      contentWidth: 0,
      columnWidths: [],
      tableWidth: 0,
    },
    displayRows: [],
    pendingResolve: null,
  });
}

function resetToastStore(): void {
  useToastStore.setState({
    isToastOpen: false,
    message: "",
    variant: "info",
    duration: 800,
    position: "top-right",
    toastKey: 0,
    pendingResolve: null,
  });
}

function EditFileHarness({
  onReady,
}: {
  onReady: (editFile: ReturnType<typeof useEditFile>) => void;
}) {
  const editFile = useEditFile();
  const readyRef = useRef(false);
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onReady(editFile);
    }
  }, [editFile, onReady]);
  return null;
}

async function renderAndGetEditFile(): Promise<ReturnType<typeof useEditFile>> {
  let editFile: ReturnType<typeof useEditFile> | undefined;
  await act(async () => {
    render(
      <AppContextProvider>
        <EditFileHarness
          onReady={(fn) => {
            editFile = fn;
          }}
        />
      </AppContextProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  if (editFile === undefined) {
    throw new Error("useEditFile was not provided");
  }
  return editFile;
}

describe("AppContext useEditFile", () => {
  let suspendMock: jest.Mock<() => Promise<void>>;
  let resumeMock: jest.Mock<() => void>;

  beforeEach(() => {
    resetAppStore();
    resetReactSessionStore();
    resetGlobalConfigStore();
    resetPickItemDialogStore();
    resetToastStore();
    delete process.env.MUDISSUE_EDITOR;

    suspendMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    resumeMock = jest.fn();
    useReactSessionStore.setState({
      suspend: suspendMock,
      resume: resumeMock,
    });

    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
      getState: () =>
        ({
          savedSearchResults: [],
          searchFolders: jest.fn(),
          searchAllFolders: jest.fn().mockResolvedValue([]),
        }) as IssueSearchStoreState,
      setState: jest.fn(),
      subscribe: jest.fn(),
      destroy: jest.fn(),
    } as IssueSearchStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ShellService.setInstance(null);
    resetAppStore();
    resetReactSessionStore();
    resetGlobalConfigStore();
    resetPickItemDialogStore();
    resetToastStore();
  });

  it("editFile uses the default editor when pickEditor is false", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues", editor: "/usr/bin/vim" },
    });
    bundle.shellService.which.mockResolvedValue("/usr/bin/vim");
    ShellService.setInstance(bundle.shellService);
    useGlobalConfigStore.setState({ globalConfig: {} });
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const editFile = await renderAndGetEditFile();

    await act(async () => {
      await editFile("/repo/issues/MI0001/issue.md");
    });

    expect(suspendMock).toHaveBeenCalled();
    expect(bundle.shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/vim",
      ["/repo/issues/MI0001/issue.md"],
    );
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      "/usr/bin/vim /repo/issues/MI0001/issue.md\n",
    );
    expect(resumeMock).toHaveBeenCalled();
    expect(usePickItemDialogStore.getState().isDialogOpen).toBe(false);

    stdoutWriteSpy.mockRestore();
  });

  it("editFile opens the editor picker and launches the selected editor when pickEditor is true", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    });
    bundle.shellService.which.mockImplementation(async (editor) => {
      if (editor === "vim") return "/usr/bin/vim";
      if (editor === "nano") return "/usr/bin/nano";
      return null;
    });
    ShellService.setInstance(bundle.shellService);
    useGlobalConfigStore.setState({ globalConfig: {} });
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const editFile = await renderAndGetEditFile();
    const pickOpenMock = jest.fn().mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "/usr/bin/nano",
    });
    usePickItemDialogStore.setState({ open: pickOpenMock });

    await act(async () => {
      await editFile("/repo/issues/MI0001/issue.md", { pickEditor: true });
    });

    expect(pickOpenMock).toHaveBeenCalled();
    expect(suspendMock).toHaveBeenCalled();
    expect(bundle.shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/nano",
      ["/repo/issues/MI0001/issue.md"],
    );
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      "/usr/bin/nano /repo/issues/MI0001/issue.md\n",
    );
    expect(resumeMock).toHaveBeenCalled();

    stdoutWriteSpy.mockRestore();
  });

  it("editFile resumes the session when editor launch fails", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    });
    bundle.shellService.which.mockImplementation(async (editor) => {
      if (editor === "vim") return "/usr/bin/vim";
      return null;
    });
    bundle.shellService.runAndWait.mockImplementation(() => {
      throw new Error("launch failed");
    });
    ShellService.setInstance(bundle.shellService);
    useGlobalConfigStore.setState({ globalConfig: {} });
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const editFile = await renderAndGetEditFile();
    usePickItemDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: "/usr/bin/vim",
      }),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await editFile("/repo/issues/MI0001/issue.md", { pickEditor: true });
      } catch (error) {
        thrown = error;
      }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("launch failed");
    expect(suspendMock).toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      "/usr/bin/vim /repo/issues/MI0001/issue.md\n",
    );
    expect(resumeMock).toHaveBeenCalled();

    stdoutWriteSpy.mockRestore();
  });

  it("editFile does not launch an editor when the picker is cancelled", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    });
    bundle.shellService.which.mockImplementation(async (editor) => {
      if (editor === "vim") return "/usr/bin/vim";
      return null;
    });
    ShellService.setInstance(bundle.shellService);
    useGlobalConfigStore.setState({ globalConfig: {} });

    const editFile = await renderAndGetEditFile();
    usePickItemDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: PickItemDialogResponseType.Cancelled,
      }),
    });

    await editFile("/repo/issues/MI0001/issue.md", { pickEditor: true });

    expect(bundle.shellService.runAndWait).not.toHaveBeenCalled();
    expect(suspendMock).not.toHaveBeenCalled();
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("editFile shows a toast when no editor is available", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    });
    bundle.shellService.which.mockResolvedValue(null);
    ShellService.setInstance(bundle.shellService);
    useGlobalConfigStore.setState({ globalConfig: {} });

    const editFile = await renderAndGetEditFile();

    await act(async () => {
      await editFile("/repo/issues/MI0001/issue.md");
    });

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: "No editor found.",
      variant: "error",
      position: "top-middle",
    });
    expect(bundle.shellService.runAndWait).not.toHaveBeenCalled();
    expect(suspendMock).not.toHaveBeenCalled();
  });
});
