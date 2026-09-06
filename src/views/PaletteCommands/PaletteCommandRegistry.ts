import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { archiveSelectedIssuePaletteCommand } from "./ArchiveSelectedIssuePaletteCommand.ts";
import { RefreshPaletteCommand } from "./RefreshPaletteCommand.ts";
import { removeSelectedIssuePaletteCommand } from "./RemoveSelectedIssuePaletteCommand.ts";
import { setSelectedIssuePriorityPaletteCommand } from "./SetSelectedIssuePriorityPaletteCommand.ts";
import { setSelectedIssueStatusPaletteCommand } from "./SetSelectedIssueStatusPaletteCommand.ts";
import { setSortingOrderPaletteCommand } from "./SetSortingOrderPaletteCommand.ts";
import { createSubissuePaletteCommand } from "./CreateSubissuePaletteCommand.ts";
import { createIssueFromFilePaletteCommand } from "./CreateIssueFromFilePaletteCommand.ts";
import { editIssuePaletteCommand } from "./EditIssuePaletteCommand.ts";
import { togglePinIssuePaletteCommand } from "./TogglePinIssuePaletteCommand.ts";
import { openShellPaletteCommand } from "./OpenShellPaletteCommand.ts";
import { copyToClipboardPaletteCommand } from "./CopyToClipboardPaletteCommand.ts";
import { linkPaletteCommand } from "./LinkPaletteCommand.ts";
import { runCustomScriptPaletteCommand } from "./RunCustomScriptPaletteCommand.ts";
import { switchRecentProjectPaletteCommand } from "./SwitchRecentProjectPaletteCommand.ts";
import { touchPaletteCommand } from "./TouchPaletteCommand.ts";
import { extractContentIntoNewIssuePaletteCommand } from "./ExtractContentIntoNewIssuePaletteCommand.ts";
import { changeLabelPaletteCommand } from "./ChangeLabelPaletteCommand.ts";
import { mergeSelectedIssuesPaletteCommand } from "./MergeSelectedIssuesPaletteCommand.ts";

export enum PaletteCommandRegistryScope {
  IssueTable = "issueTable",
  IssueViewer = "issueViewer",
}

const registry = new Map<PaletteCommandRegistryScope, PaletteCommand[]>();

export class PaletteCommandRegistry {
  static registerPaletteCommand(
    scopes: PaletteCommandRegistryScope[],
    command: PaletteCommand,
  ): void {
    for (const scope of scopes) {
      const list = registry.get(scope) ?? [];
      list.push(command);
      registry.set(scope, list);
    }
  }

  static getPaletteCommands(
    scope: PaletteCommandRegistryScope,
  ): readonly PaletteCommand[] {
    return [...(registry.get(scope) ?? [])];
  }
}

PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueTable],
  switchRecentProjectPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueTable],
  setSortingOrderPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueTable],
  new RefreshPaletteCommand(),
);
PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueTable],
  mergeSelectedIssuesPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  removeSelectedIssuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  archiveSelectedIssuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  setSelectedIssuePriorityPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  setSelectedIssueStatusPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  togglePinIssuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  openShellPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueTable],
  createIssueFromFilePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  editIssuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  linkPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [PaletteCommandRegistryScope.IssueViewer],
  extractContentIntoNewIssuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  createSubissuePaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  copyToClipboardPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  touchPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  changeLabelPaletteCommand,
);
PaletteCommandRegistry.registerPaletteCommand(
  [
    PaletteCommandRegistryScope.IssueTable,
    PaletteCommandRegistryScope.IssueViewer,
  ],
  runCustomScriptPaletteCommand,
);
