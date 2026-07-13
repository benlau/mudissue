import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import { FileService } from "../../services/FileService.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { IssueFolderStorage } from "../../utils/storage/IssueFolderStorage.ts";
import { useEditFile } from "../../contexts/AppContext.tsx";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import { useMarkdownViewerHandleStore } from "../../store/MarkdownViewerHandleStore.ts";
import { usePopupStore } from "../../store/PopupStore.ts";
import { usePaletteCommandStore } from "../../store/PaletteCommandStore.ts";
import {
  PaletteCommandRegistry,
  PaletteCommandRegistryScope,
} from "../PaletteCommands/PaletteCommandRegistry.ts";
import { IssueBreadcrumbs } from "./IssueBreadcrumbs.tsx";
import { ToolBar, type ToolbarConfigItem } from "./ToolBar.tsx";
import {
  MarkdownViewer,
  type MarkdownViewerChangedPayload,
} from "./MarkdownViewer.tsx";
import { EditIssueMarkdownFileHelper } from "../../helpers/EditIssueMarkdownFileHelper.ts";
import { CustomScriptPaletteHelper } from "../../helpers/CustomScriptPaletteHelper.ts";
import { useTerminalSize, useTerminalName } from "../hooks/useTerminal.ts";

const issueViewerMessages = defineMessages({
  externalEditLabel: {
    id: "views.issueViewer.toolbar.externalEdit.label",
    defaultMessage: "External Edit",
  },
  externalEditDescription: {
    id: "views.issueViewer.toolbar.externalEdit.description",
    defaultMessage: "Edit this issue file in an external editor",
  },
  externalEditPaletteLabel: {
    id: "views.issueViewer.command.externalEdit.label",
    defaultMessage: "External Edit",
  },
  externalEditPaletteDescription: {
    id: "views.issueViewer.command.externalEdit.description",
    defaultMessage: "Open the issue file in an external editor",
  },
});

export type IssueViewerProps = {
  issue: IssueFolder;
};

export function IssueViewer({
  issue,
}: IssueViewerProps) {
  const intl = useIntl();
  const closeIssue = useAppStore((s) => s.closeIssue);
  const openPreviousIssue = useAppStore((s) => s.openPreviousIssue);
  const openNextIssue = useAppStore((s) => s.openNextIssue);
  const editFile = useEditFile();
  const applyIssueMetadataUpdate = useAppStore((s) => s.applyIssueMetadataUpdate);
  const hasPopup = usePopupStore((s) => s.hasPopup);
  const fileService = FileService.getInstance();

  useTerminalName(issue.folderName);
  const { cols, rows: terminalRows } = useTerminalSize();
  const [displayTitle, setDisplayTitle] = useState("");
  const [issueFilePath, setIssueFilePath] = useState<string | undefined>();
  const [pathResolved, setPathResolved] = useState(false);

  const cancelledRef = useRef(false);
  const selectedLogicalLineIndexRef = useRef(0);
  const markdownViewerHandle = useMarkdownViewerHandleStore();
  const [isEditingFile, setIsEditingFile] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;
    setDisplayTitle("");
    setPathResolved(false);
    setIssueFilePath(undefined);

    const resolvePath = async () => {
      const storage = new IssueFolderStorage(issue);
      const filePath = await storage.findIssueFile();
      if (cancelledRef.current) return;
      setIssueFilePath(filePath);
      setPathResolved(true);
      if (!filePath) {
        setDisplayTitle(issue.metadata?.title ?? issue.folderName);
      }
    };

    void resolvePath();
    return () => {
      cancelledRef.current = true;
    };
    // Depend on issue identity only — metadata updates must not remount MarkdownViewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- issue object identity changes on metadata update
  }, [issue.issueId, issue.folderName, issue.path, fileService]);

  const handleMarkdownChanged = useCallback(
    (payload: MarkdownViewerChangedPayload) => {
      const headerTitle =
        payload.displayTitle ?? issue.metadata?.title ?? issue.folderName;
      setDisplayTitle(headerTitle);

      const storeTitle =
        payload.frontmatterTitle?.trim() !== ""
          ? payload.frontmatterTitle?.trim()
          : undefined;
      const titleChanged =
        (issue.metadata?.title ?? undefined) !== (storeTitle ?? undefined);
      const statusChanged =
        (issue.metadata?.status ?? undefined) !== (payload.status ?? undefined);
      const priorityChanged =
        (issue.metadata?.priority ?? undefined) !==
        (payload.priority ?? undefined);

      if (titleChanged || statusChanged || priorityChanged) {
        applyIssueMetadataUpdate(issue.issueId, {
          title: storeTitle,
          status: payload.status,
          priority: payload.priority,
          updatedAt: payload.updatedAt,
        });
      }
    },
    [applyIssueMetadataUpdate, issue],
  );

  const rows = Math.max(5, terminalRows);

  // When the UI layout is changed, you must update
  // the parameter to make sure the pageSize is correct.
  // Otherwise, some line may lost randomly.
  const HEADER_HEIGHT = 1;
  const FOOTER_HEIGHT = 1;
  const contentHeight = Math.max(1, rows - HEADER_HEIGHT - FOOTER_HEIGHT);

  const handleLogicalLineIndexChanged = useCallback((logicalLineIndex: number) => {
    selectedLogicalLineIndexRef.current = logicalLineIndex;
  }, []);

  const handleOpenTextEditDialog = useCallback(async () => {
    if (!issueFilePath) return;
    const result = await EditIssueMarkdownFileHelper.edit(issue, {
      filePath: issueFilePath,
      initialLineIndex: selectedLogicalLineIndexRef.current,
    });
    selectedLogicalLineIndexRef.current = result.lastLogicalLineIndex;
    useFileWatcherStore.getState().cancelReload(issueFilePath);
    const raw = (await fileService.readFile(issueFilePath, "utf-8")) as string;
    markdownViewerHandle.getState().setContent({
      content: raw,
      logicalLineIndex: result.lastLogicalLineIndex,
    });
  }, [issue, issueFilePath, markdownViewerHandle, fileService]);

  const handlePickEditor = useCallback(async () => {
    if (!issueFilePath || isEditingFile) return;

    setIsEditingFile(true);
    try {
      await editFile(issueFilePath, { pickEditor: true });
    } finally {
      setIsEditingFile(false);
    }
  }, [editFile, isEditingFile, issueFilePath]);

  const currentTrackerRepo = useCurrentTrackerRepoStore(
    (s) => s.currentTrackerRepo,
  );
  const customScriptPaletteHelper = useMemo(
    () => new CustomScriptPaletteHelper(),
    [],
  );

  const buildViewerPaletteCommands = useCallback((): PaletteCommand[] => {
    const scripts =
      useCurrentTrackerRepoStore.getState().currentTrackerRepo?.config.scripts;
    return [
      {
        label: intl.formatMessage(issueViewerMessages.externalEditPaletteLabel),
        key: "externalEdit",
        shortcutKey: "c+e",
        description: intl.formatMessage(
          issueViewerMessages.externalEditPaletteDescription,
        ),
        isDisabled: !issueFilePath,
        callback: async () => {
          await handlePickEditor();
        },
      },
      ...PaletteCommandRegistry.getPaletteCommands(
        PaletteCommandRegistryScope.IssueViewer,
      ),
      ...customScriptPaletteHelper.buildPaletteCommands(scripts ?? []),
    ];
  }, [customScriptPaletteHelper, handlePickEditor, intl, issueFilePath]);

  const openViewerPalette = useCallback(
    (options?: {
      initialFilterQuery?: string;
      toolbarItems?: ToolbarConfigItem[];
    }) => {
      usePaletteCommandStore.getState().open({
        commands: buildViewerPaletteCommands(),
        toolbarItems: options?.toolbarItems,
        initialFilterQuery: options?.initialFilterQuery ?? ":",
      });
    },
    [buildViewerPaletteCommands],
  );

  useEffect(() => {
    usePaletteCommandStore
      .getState()
      .replaceCommands(buildViewerPaletteCommands());
  }, [buildViewerPaletteCommands, currentTrackerRepo]);

  const toolbarItems = useMemo<ToolbarConfigItem[]>(() => {
    const list: ToolbarConfigItem[] = [
      {
        label: "Back",
        key: "Esc",
        callback: () => {
          closeIssue();
        },
      },
      {
        label: "Edit",
        key: "E",
        callback: () => {
          void handleOpenTextEditDialog();
        },
      },
      {
        label: intl.formatMessage(issueViewerMessages.externalEditLabel),
        key: "c+e",
        description: intl.formatMessage(
          issueViewerMessages.externalEditDescription,
        ),
        isDisabled: !issueFilePath,
        callback: () => {
          void handlePickEditor();
        },
      },
      {
        label: "Prev",
        key: "c+PgUp",
        callback: () => {
          openPreviousIssue();
        },
      },
      {
        label: "Next",
        key: "c+PgDn",
        callback: () => {
          openNextIssue();
        },
      },
      {
        label: "Command",
        key: ":",
        callback: () => {
          openViewerPalette({
            toolbarItems: list.slice(),
            initialFilterQuery: ":",
          });
        },
      },
    ];
    return list;
  }, [
    closeIssue,
    handlePickEditor,
    handleOpenTextEditDialog,
    intl,
    issueFilePath,
    openNextIssue,
    openPreviousIssue,
    openViewerPalette,
  ]);

  return (
    <Box flexDirection="column" height={rows}>
      <Box height={HEADER_HEIGHT}>
        <IssueBreadcrumbs title={displayTitle} width={cols} />
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {!pathResolved ? (
          <Box height={contentHeight} />
        ) : issueFilePath ? (
          <MarkdownViewer
            handle={markdownViewerHandle}
            path={issueFilePath}
            width={cols}
            height={contentHeight}
            issueFolder={issue}
            isDisabled={isEditingFile}
            onChanged={handleMarkdownChanged}
            onLogicalLineIndexChanged={handleLogicalLineIndexChanged}
          />
        ) : (
          <Box height={contentHeight}>
            <Text>{"<No issue file found>"}</Text>
          </Box>
        )}
      </Box>
      <Box>
        <ToolBar
          width={cols}
          items={toolbarItems}
          isDisabled={isEditingFile || hasPopup}
        />
      </Box>
    </Box>
  );
}
