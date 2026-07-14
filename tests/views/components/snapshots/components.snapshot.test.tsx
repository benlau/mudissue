import React from "react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Box, Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { IntlProvider } from "react-intl";
import stripAnsi from "strip-ansi";
import { AlertDialog } from "../../../../src/views/components/AlertDialog.tsx";
import { ConfirmationDialog } from "../../../../src/views/components/ConfirmationDialog.tsx";
import { CreateIssueDialog } from "../../../../src/views/components/CreateIssueDialog.tsx";
import { CreateIssueFromFileDialog } from "../../../../src/views/components/CreateIssueFromFileDialog.tsx";
import { TextEditDialog } from "../../../../src/views/components/TextEditDialog.tsx";
import { IssueTable } from "../../../../src/views/components/IssueTable.tsx";
import { IssueBreadcrumbs } from "../../../../src/views/components/IssueBreadcrumbs.tsx";
import { IssueViewer } from "../../../../src/views/components/IssueViewer.tsx";
import { PickItemDialog } from "../../../../src/views/components/PickItemDialog.tsx";
import {
  stackedViewerNavigationStack,
  viewerNavigationStack,
} from "../../../fixture/navigationStack.ts";
import { SearchingDialog } from "../../../../src/views/components/SearchingDialog.tsx";
import { TextInputDialog } from "../../../../src/views/components/TextInputDialog.tsx";
import { Toast } from "../../../../src/views/components/Toast.tsx";
import { ToolBar } from "../../../../src/views/components/ToolBar.tsx";
import { PaletteCommandDialog } from "../../../../src/views/components/PaletteCommandDialog.tsx";
import { IssueSearchingDialog } from "../../../../src/views/components/IssueSearchingDialog.tsx";
import {
  createFilterTextDialogStore,
  FilterTextDialog,
} from "../../../../src/views/components/FilterTextDialog.tsx";
import { AppContextProvider } from "../../../../src/contexts/AppContext.tsx";
import { resetAppStore, useAppStore } from "../../../../src/store/AppStore.ts";
import type { IssueSearchStoreState } from "../../../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../../../src/store/IssueSearchStore.ts";
import { useIssueSearchingDialogStore } from "../../../../src/store/IssueSearchingDialogStore.ts";
import { useConfirmationDialogStore } from "../../../../src/store/ConfirmationDialogStore.ts";
import {
  usePickItemDialogStore,
} from "../../../../src/views/components/PickItemDialog.tsx";
import { useCreateIssueDialogStore } from "../../../../src/store/CreateIssueDialogStore.ts";
import { useCreateIssueFromFileDialogStore } from "../../../../src/store/CreateIssueFromFileDialogStore.ts";
import { useTextEditDialogStore } from "../../../../src/store/TextEditDialogStore.ts";
import { useTextInputDialogStore } from "../../../../src/store/TextInputDialogStore.ts";
import { useAlertDialogStore } from "../../../../src/store/AlertDialogStore.ts";
import { PopupNames, usePopupStore } from "../../../../src/store/PopupStore.ts";
import { useToastStore } from "../../../../src/store/ToastStore.ts";
import { usePaletteCommandStore } from "../../../../src/store/PaletteCommandStore.ts";
import { createMockSystemContext } from "../../../fixture/MockSystemContext.tsx";
import type { MockSystemContextBundle } from "../../../fixture/MockSystemContext.tsx";
import { useTerminalSizeStore } from "../../../../src/views/hooks/useTerminal.ts";

type TerminalSize = { columns: number; rows: number };

type SnapshotCaseContext = {
  bundle: MockSystemContextBundle;
};

type SnapshotCase = {
  id: string;
  terminalSize?: TerminalSize;
  setup?: (ctx: SnapshotCaseContext) => void | Promise<void>;
  teardown?: (ctx: SnapshotCaseContext) => void | Promise<void>;
  render: () => React.ReactElement;
};

// Keep snapshot terminal sizes modest (e.g. 10×8). Very wide viewports
// produce huge snapshot diffs that are hard to read and review in PRs.
const ISSUE_TABLE_SNAPSHOT_TERMINAL_SIZE = {
  columns: 20,
  rows: 8,
} as const;

const ISSUE_TABLE_PROJECT_NAME_SNAPSHOT_THRESHOLD = 5;

function FilterTextDialogSnapshotHarness() {
  const storeRef = React.useRef(createFilterTextDialogStore());
  React.useEffect(() => {
    storeRef.current.getState().open({
      onFilterQueryChanged: () => {},
    });
    storeRef.current.getState().setChoiceList([
      { key: "alpha", text: "Alpha option" },
      { key: "beta", text: "Beta option" },
    ]);
  }, []);
  return (
    <FilterTextDialog
      store={storeRef.current}
      isActive={true}
      title="Filter"
      placeholder="filter…"
      noMatchesLabel="No matches"
      footerCancelLabel="Cancel"
      footerConfirmLabel="Confirm"
    />
  );
}

const defaultIssue = {
  issueId: "MI0001",
  folderName: "MI0001-sample",
  path: "/tmp/MI0001-sample",
  metadata: {
    title: "Sample issue",
    status: "open",
  },
};

const breadcrumbIssueA = {
  issueId: "MI0001",
  folderName: "MI0001-alpha",
  path: "/tmp/MI0001-alpha",
};

const breadcrumbIssueB = {
  issueId: "MI0002",
  folderName: "MI0002-beta",
  path: "/tmp/MI0002-beta",
};

const breadcrumbIssueC = {
  issueId: "MI0003",
  folderName: "MI0003-gamma",
  path: "/tmp/MI0003-gamma",
};

const breadcrumbIssueD = {
  issueId: "MI0004",
  folderName: "MI0004-delta",
  path: "/tmp/MI0004-delta",
};

function resetDialogStores(): void {
  useConfirmationDialogStore.setState({
    isDialogOpen: false,
    title: "",
    message: "",
    confirmLabel: undefined,
    variant: "default",
    ctrlCToConfirm: false,
    pendingResolve: null,
  });
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
  useCreateIssueFromFileDialogStore.setState({
    isDialogOpen: false,
    pendingResolve: null,
  });
  useCreateIssueDialogStore.setState({
    isDialogOpen: false,
    openSession: 0,
  });
  useTextEditDialogStore.setState({
    isDialogOpen: false,
    openSession: 0,
    filePath: null,
    initialLineIndex: 0,
    pendingResolve: null,
  });
  useTextInputDialogStore.setState({
    isDialogOpen: false,
    title: "",
    prompt: "",
    placeholder: "",
    confirmLabel: undefined,
    value: "",
    error: null,
    inputKey: 0,
    validate: null,
    pendingResolve: null,
    activeOpenPromise: null,
  });
  useAlertDialogStore.setState({
    isDialogOpen: false,
    message: "",
    pendingResolve: null,
  });
  useToastStore.setState({
    isToastOpen: false,
    message: "",
    variant: "info",
    duration: 800,
    position: "top-right",
    toastKey: 0,
    pendingResolve: null,
  });
  usePaletteCommandStore.setState({
    isOpen: false,
    commands: [],
    toolbarItems: [],
    initialFilterQuery: ":",
    lastUsedCommandKey: null,
  });
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
}

function createSnapshotCaseContext(): SnapshotCaseContext {
  resetAppStore();
  resetDialogStores();
  const bundle = createMockSystemContext();
  bundle.fileService.exists.mockResolvedValue(false);
  bundle.fileService.readdir.mockResolvedValue([]);
  bundle.fileService.readFile.mockResolvedValue("# Title\n\nBody");
  bundle.fileService.watch.mockReturnValue(() => {});
  bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
    name: "mudissue",
    projectPath: "/tmp/repo",
    trackerPath: "/tmp/repo",
    config: {},
  });
  bundle.registryService.getRecentProjects.mockResolvedValue([]);
  bundle.registryService.get.mockResolvedValue(null);
  jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
    getState: () =>
      ({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([defaultIssue]),
      }) as IssueSearchStoreState,
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  } as IssueSearchStore);
  useAppStore.setState({
    mainIssueLists: [defaultIssue],
    filter: "status:open",
    refreshIssueLists: jest.fn().mockImplementation(async () => {
      return useAppStore.getState().mainIssueLists ?? [];
    }),
  });
  return { bundle };
}

const snapshotCases: SnapshotCase[] = [
  {
    id: "AlertDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useAlertDialogStore.setState({
        isDialogOpen: true,
        message: "Snapshot alert",
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <AlertDialog />
      </Box>
    ),
  },
  {
    id: "ConfirmationDialog",
    setup: () => {
      useConfirmationDialogStore.setState({
        isDialogOpen: true,
        title: "Confirm action",
        message: "Do you want to continue?",
        confirmLabel: "Continue",
      });
    },
    terminalSize: { columns: 20, rows: 10 },
    render: () => (
      <Box width={20} height={10}>
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "ConfirmationDialog-quit",
    setup: () => {
      usePopupStore.getState().pushPopup(PopupNames.ConfirmationDialog);
      useConfirmationDialogStore.setState({
        isDialogOpen: true,
        title: "Quit MudIssue?",
        message: "Press Ctrl+C or Enter to quit. Press any other key to cancel.",
        confirmLabel: "Quit",
        variant: "destructive",
        ctrlCToConfirm: true,
      });
    },
    terminalSize: { columns: 56, rows: 10 },
    render: () => (
      <Box width={56} height={10}>
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "CreateIssueDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useCreateIssueDialogStore.getState().open();
    },
    render: () => (
      <Box width={20} height={10}>
        <CreateIssueDialog />
      </Box>
    ),
  },
  {
    id: "TextEditDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useTextEditDialogStore.getState().open({
        filePath: "/repo/issues/MI0001-sample/MI0001-sample.md",
        initialLineIndex: 0,
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <IntlProvider locale="en" messages={{}}>
          <TextEditDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "CreateIssueFromFileDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useCreateIssueFromFileDialogStore.setState({
        isDialogOpen: true,
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <IntlProvider locale="en" messages={{}}>
          <CreateIssueFromFileDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "IssueTable",
    terminalSize: ISSUE_TABLE_SNAPSHOT_TERMINAL_SIZE,
    render: () => (
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>
          <IssueTable />
        </AppContextProvider>
      </IntlProvider>
    ),
  },
  {
    id: "IssueTable-projectNameHeader",
    terminalSize: ISSUE_TABLE_SNAPSHOT_TERMINAL_SIZE,
    render: () => (
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>
          <IssueTable
            largeTerminalHeightThreshold={
              ISSUE_TABLE_PROJECT_NAME_SNAPSHOT_THRESHOLD
            }
          />
        </AppContextProvider>
      </IntlProvider>
    ),
  },
  {
    id: "IssueViewer",
    terminalSize: { columns: 132, rows: 12 },
    setup: () => {
      useAppStore.setState({
        navigationStack: viewerNavigationStack(defaultIssue),
      });
    },
    render: () => (
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>
          <IssueViewer issue={defaultIssue} />
        </AppContextProvider>
      </IntlProvider>
    ),
  },
  {
    id: "IssueBreadcrumbs-single",
    terminalSize: { columns: 40, rows: 1 },
    setup: () => {
      useAppStore.setState({
        navigationStack: viewerNavigationStack(breadcrumbIssueA),
      });
    },
    render: () => (
      <Box width={40}>
        <IssueBreadcrumbs title="Sample issue title" width={40} />
      </Box>
    ),
  },
  {
    id: "IssueBreadcrumbs-one-previous",
    terminalSize: { columns: 40, rows: 1 },
    setup: () => {
      useAppStore.setState({
        navigationStack: stackedViewerNavigationStack([
          breadcrumbIssueA,
          breadcrumbIssueB,
        ]),
      });
    },
    render: () => (
      <Box width={40}>
        <IssueBreadcrumbs title="Current title" width={40} />
      </Box>
    ),
  },
  {
    id: "IssueBreadcrumbs-two-previous",
    terminalSize: { columns: 48, rows: 1 },
    setup: () => {
      useAppStore.setState({
        navigationStack: stackedViewerNavigationStack([
          breadcrumbIssueA,
          breadcrumbIssueB,
          breadcrumbIssueC,
        ]),
      });
    },
    render: () => (
      <Box width={48}>
        <IssueBreadcrumbs title="Current title" width={48} />
      </Box>
    ),
  },
  {
    id: "IssueBreadcrumbs-three-previous-shows-last-two",
    terminalSize: { columns: 48, rows: 1 },
    setup: () => {
      useAppStore.setState({
        navigationStack: stackedViewerNavigationStack([
          breadcrumbIssueA,
          breadcrumbIssueB,
          breadcrumbIssueC,
          breadcrumbIssueD,
        ]),
      });
    },
    render: () => (
      <Box width={48}>
        <IssueBreadcrumbs title="Current title" width={48} />
      </Box>
    ),
  },
  {
    id: "IssueBreadcrumbs-truncated-title",
    terminalSize: { columns: 18, rows: 1 },
    setup: () => {
      useAppStore.setState({
        navigationStack: viewerNavigationStack(breadcrumbIssueA),
      });
    },
    render: () => (
      <Box width={18}>
        <IssueBreadcrumbs
          title="A very long issue title that will truncate"
          width={18}
        />
      </Box>
    ),
  },
  {
    id: "PickItemDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      const items = [
        { id: "1", name: "Project A", projectPath: "/very/long/path/to/project-a" },
        { id: "2", name: "Project B", projectPath: "/very/long/path/to/project-b" },
      ];
      usePickItemDialogStore.setState({
        isDialogOpen: true,
        items,
        getDisplay: (item: unknown) => {
          const record = item as { name: string; projectPath: string };
          return [record.name, record.projectPath];
        },
        title: "Recent Projects",
        columns: [{ expectedWidth: 20 }, { expectedWidth: 20 }],
        footerLabel: "Cancel<Esc>",
        minWidth: 52,
        maxWidth: 86,
      });
    },
    render: () => (
      <Box width={80} height={24}>
        <PickItemDialog />
      </Box>
    ),
  },
  {
    id: "SearchingDialog",
    terminalSize: { columns: 20, rows: 10 },
    render: () => (
      <Box width={20} height={10}>
        <SearchingDialog
          isDialogOpen={true}
          value=""
          setValue={() => {}}
          close={() => {}}
          confirm={() => {}}
          dialogRecentFilters={["status:open", "status:closed"]}
          dialogInputKey={1}
          dialogInputInitialValue=""
        />
      </Box>
    ),
  },
  {
    id: "Toast",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useToastStore.setState({
        isToastOpen: true,
        message: "Saved",
        variant: "info",
        duration: 800,
        position: "top-right",
        toastKey: 1,
        pendingResolve: null,
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <Toast />
      </Box>
    ),
  },
  {
    id: "Toast-truncated",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useToastStore.setState({
        isToastOpen: true,
        message: "This toast message is far too long to fit on screen",
        variant: "info",
        duration: 800,
        position: "top-right",
        toastKey: 1,
        pendingResolve: null,
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <Toast />
      </Box>
    ),
  },
  {
    id: "TextInputDialog",
    terminalSize: { columns: 20, rows: 10 },
    setup: () => {
      useTextInputDialogStore.setState({
        isDialogOpen: true,
        title: "Change Issue ID",
        prompt: "New ID: ",
        placeholder: "e.g. MI042",
        value: "",
        error: null,
        inputKey: 1,
      });
      usePopupStore.setState({
        popupStack: [PopupNames.TextInputDialog],
        hasPopup: true,
        latestPopup: PopupNames.TextInputDialog,
      });
    },
    render: () => (
      <Box width={20} height={10}>
        <IntlProvider locale="en" messages={{}}>
          <TextInputDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "FilterTextDialog",
    terminalSize: { columns: 40, rows: 20 },
    render: () => (
      <Box width={40} height={20}>
        <FilterTextDialogSnapshotHarness />
      </Box>
    ),
  },
  {
    id: "PaletteCommandDialog",
    terminalSize: { columns: 40, rows: 20 },
    setup: () => {
      usePaletteCommandStore.getState().open({
        commands: [
        {
          label: "New",
          key: "new",
          shortcutKey: "+",
          description: "Create a new issue",
          callback: async () => {},
        },
        {
          label: "Search",
          key: "search",
          shortcutKey: "/",
          description: "Filter issues by text search",
          callback: async () => {},
        },
        {
          label: "Link",
          key: "link",
          shortcutKey: "l",
          description: "Link selected issue to another",
          callback: async () => {},
        },
        {
          label: "Touch",
          key: "touch",
          shortcutKey: "t",
          description: "Bump updated_at on selected issues",
          callback: async () => {},
        },
        {
          label: "Archive",
          key: "archive",
          shortcutKey: "a",
          description: "Archive selected issues",
          callback: async () => {},
        },
        {
          label: "Copy",
          key: "copy",
          shortcutKey: "y",
          description: "Copy issue id to clipboard",
          callback: async () => {},
        },
        {
          label: "Status",
          key: "status",
          shortcutKey: "s",
          description: "Set status on selected issues",
          callback: async () => {},
        },
        {
          label: "Priority",
          key: "priority",
          shortcutKey: "p",
          description: "Set priority on selected issues",
          callback: async () => {},
        },
        {
          label: "Sort",
          key: "sort",
          shortcutKey: "o",
          description: "Change issue sort order",
          callback: async () => {},
        },
        {
          label: "Shell",
          key: "shell",
          shortcutKey: "!",
          description: "Open shell in issue folder",
          callback: async () => {},
        },
        {
          label: "Project",
          key: "project",
          shortcutKey: "r",
          description: "Switch recent project",
          callback: async () => {},
        },
        {
          label: "Script",
          key: "script",
          shortcutKey: "x",
          description: "Run custom script from mud.conf",
          callback: async () => {},
        },
        ],
        initialFilterQuery: ":",
      });
    },
    render: () => (
      <Box width={40} height={20}>
        <IntlProvider locale="en" messages={{}}>
          <PaletteCommandDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "IssueSearchingDialog",
    terminalSize: { columns: 40, rows: 20 },
    setup: async () => {
      jest.useFakeTimers();
      const sampleIssues = [
        {
          issueId: "0001",
          folderName: "0001-alpha",
          path: "/repo/issues/0001-alpha",
          metadata: { title: "Alpha issue" },
        },
        {
          issueId: "0002",
          folderName: "0002-beta",
          path: "/repo/issues/0002-beta",
          metadata: { title: "Beta issue" },
        },
      ];
      const mockSearchAllFolders = jest
        .fn<() => Promise<typeof sampleIssues>>()
        .mockResolvedValue(sampleIssues);
      jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
        getState: () => ({ searchAllFolders: mockSearchAllFolders }),
      } as unknown as IssueSearchStore);
      void useIssueSearchingDialogStore.getState().open({
        title: "blocking",
        confirmLabel: "Link",
      });
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    },
    teardown: () => {
      jest.useRealTimers();
      jest.restoreAllMocks();
      useIssueSearchingDialogStore.setState({
        isOpen: false,
        title: "",
        confirmLabel: "",
        excludeFolderNames: [],
        pendingResolve: null,
      });
      usePopupStore.setState({
        popupStack: [],
        hasPopup: false,
        latestPopup: null,
      });
    },
    render: () => (
      <Box width={40} height={20}>
        <IntlProvider locale="en" messages={{}}>
          <IssueSearchingDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "PaletteCommandDialogToolbarHelp",
    terminalSize: { columns: 40, rows: 20 },
    setup: () => {
      usePaletteCommandStore.getState().open({
        commands: [],
        toolbarItems: [
          {
            label: "Quit",
            key: "c+c",
            callback: () => {},
            description: "Quit the application",
          },
          {
            label: "Copy",
            key: "c",
            callback: () => {},
            description: "Show a popup to copy information to clipboard",
          },
        ],
        initialFilterQuery: "?",
      });
    },
    render: () => (
      <Box width={40} height={20}>
        <IntlProvider locale="en" messages={{}}>
          <PaletteCommandDialog />
        </IntlProvider>
      </Box>
    ),
  },
  {
    id: "ToolBar",
    render: () => (
      <ToolBar
        width={60}
        items={[
          { label: "Back", key: "Esc", callback: () => {} },
          { label: "Open", key: "Enter", callback: () => {} },
          { label: "Search", key: "/", callback: () => {} },
        ]}
      />
    ),
  },
];

/** Strip ANSI codes then trailing spaces/tabs per line for stable snapshots. */
function normalizeSnapshotFrame(raw: string): string {
  return stripAnsi(raw).replace(/[ \t]+$/gm, "");
}

describe("views/components snapshots", () => {
  afterEach(() => {
    cleanup();
    resetAppStore();
  });

  for (const snapshotCase of snapshotCases) {
    it(`matches snapshot: ${snapshotCase.id}`, async () => {
      const size = snapshotCase.terminalSize ?? { columns: 40, rows: 20 };
      useTerminalSizeStore.setState({ cols: size.columns, rows: size.rows });
      const ctx = createSnapshotCaseContext();
      await snapshotCase.setup?.(ctx);
      const view = render(snapshotCase.render());
      const frame = normalizeSnapshotFrame(view.lastFrame() ?? "");
      expect(frame).toMatchSnapshot();
      await snapshotCase.teardown?.(ctx);
    });
  }
});
