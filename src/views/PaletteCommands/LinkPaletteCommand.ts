import { defineMessages } from "react-intl";
import { IssueLinkHelper } from "../../helpers/IssueLinkHelper.ts";
import { intl } from "../../intl.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../../store/GlobalConfigStore.ts";
import { IssueMetadataChangedPostHookContext } from "../../store/IssueMetadataChangedPostHookStore.ts";
import {
  IssueSearchingDialogResponseType,
  useIssueSearchingDialogStore,
} from "../../store/IssueSearchingDialogStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import { LinkageTypesAccessor } from "../../types/linkage.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { isErrorResponse } from "../../types/Response.ts";
import { TrackerRepoConfigAccessor } from "../../types/Tracker.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.linkIssue.label",
    defaultMessage: "Link Issue",
  },
  description: {
    id: "views.paletteCommands.linkIssue.description",
    defaultMessage: "Link the selected issue(s) to another issue",
  },
  pickLinkTypeTitle: {
    id: "views.paletteCommands.linkIssue.pickLinkTypeTitle",
    defaultMessage: "Link type",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.linkIssue.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  confirmLabel: {
    id: "views.paletteCommands.linkIssue.confirmLabel",
    defaultMessage: "Link",
  },
  repoNotFoundAlert: {
    id: "views.paletteCommands.linkIssue.repoNotFoundAlert",
    defaultMessage: "Could not find the project for this issue.",
  },
  successToast: {
    id: "views.paletteCommands.linkIssue.successToast",
    defaultMessage: "Linked to {dst}",
  },
  successToastPlural: {
    id: "views.paletteCommands.linkIssue.successToastPlural",
    defaultMessage: "Linked {count} issues to {dst}",
  },
});

export class LinkPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "linkIssue";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const sources = useAppStore.getState().getSelectedIssues();
    if (sources.length === 0) {
      return;
    }

    const firstIssue = sources[0]!;
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .findTrackerRepoForIssueFolder(firstIssue);
    if (repo == null) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.repoNotFoundAlert));
      return;
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const linkTypes = new TrackerRepoConfigAccessor(
      repo.config,
      globalConfig,
    ).getEffectiveLinkTypes();
    const fieldNames =
      LinkageTypesAccessor.fromPairs(linkTypes).getAllFieldNames();

    const linkTypeResponse = await usePickItemDialogStore
      .getState()
      .open(fieldNames, (linkType) => linkType, {
        title: intl.formatMessage(messages.pickLinkTypeTitle),
        footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
      });

    if (
      linkTypeResponse.type !== PickItemDialogResponseType.Accepted ||
      linkTypeResponse.acceptedValue == null
    ) {
      return;
    }

    const linkType = linkTypeResponse.acceptedValue;

    const targetResponse = await useIssueSearchingDialogStore.getState().open({
      title: linkType,
      confirmLabel: intl.formatMessage(messages.confirmLabel),
      excludeFolderNames: sources.map((issue) => issue.folderName),
    });

    if (
      targetResponse.type !== IssueSearchingDialogResponseType.Accepted ||
      targetResponse.issue == null
    ) {
      return;
    }

    const dstIssue = targetResponse.issue;

    for (const src of sources) {
      try {
        const srcPostHookContext = new IssueMetadataChangedPostHookContext();
        const dstPostHookContext = new IssueMetadataChangedPostHookContext();
        await srcPostHookContext.readOldMetadata(src, repo.name);
        await dstPostHookContext.readOldMetadata(dstIssue, repo.name);

        await IssueLinkHelper.link(
          src.folderName,
          linkType,
          dstIssue.folderName,
          repo.name,
        );

        await srcPostHookContext.notifyMetadataChanged();
        await dstPostHookContext.notifyMetadataChanged();
      } catch (err) {
        if (isErrorResponse(err)) {
          await useAlertDialogStore.getState().open(err.error.message);
          return;
        }
        throw err;
      }
    }

    await useAppStore.getState().refreshIssueLists();

    const dstLabel = dstIssue.metadata?.title?.trim() || dstIssue.folderName;
    await useToastStore
      .getState()
      .info(
        intl.formatMessage(
          sources.length === 1
            ? messages.successToast
            : messages.successToastPlural,
          sources.length === 1
            ? { dst: dstLabel }
            : { dst: dstLabel, count: sources.length },
        ),
        { position: "center" },
      );
  }
}

export const linkPaletteCommand: PaletteCommand = new LinkPaletteCommand();
