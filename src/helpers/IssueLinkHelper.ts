import { IssueSelectorArgumentHelper } from "./IssueSelectorArgumentHelper.ts";
import { IssueFolderLinkFormatter } from "../foundation/formatter/IssueFolderLinkFormatter.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { useIssueMetadataChangedPostHookStore } from "../store/IssueMetadataChangedPostHookStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { ErrorResponse } from "../types/Response.ts";
import { LinkageTypesAccessor, type LinkagePair } from "../types/linkage.ts";
import { TrackerRepoConfigAccessor } from "../types/Tracker.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../utils/storage/IssueMarkdownFileStorage.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";

export type IssueLinkResult = {
  srcIssue: IssueFolder;
  dstIssue: IssueFolder | null;
  dstNotFound: boolean;
  linkType: string;
  srcField: string;
  dstField: string;
};

export class IssueLinkHelper {
  static async link(
    srcSelector: string,
    linkType: string,
    dstSelector: string,
    project?: string,
  ): Promise<IssueLinkResult> {
    return IssueLinkHelper.applyLinkChange(
      srcSelector,
      linkType,
      dstSelector,
      project,
      "link",
    );
  }

  static async unlink(
    srcSelector: string,
    linkType: string,
    dstSelector: string,
    project?: string,
  ): Promise<IssueLinkResult> {
    return IssueLinkHelper.applyLinkChange(
      srcSelector,
      linkType,
      dstSelector,
      project,
      "unlink",
    );
  }

  private static async applyLinkChange(
    srcSelector: string,
    linkType: string,
    dstSelector: string,
    project: string | undefined,
    mode: "link" | "unlink",
  ): Promise<IssueLinkResult> {
    const { repo, issue: srcIssue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        srcSelector,
        project,
      );

    const dstFolders = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(dstSelector, { project: project ?? repo.name });
    const dstNotFound =
      mode === "unlink" &&
      (dstFolders == null ||
        (Array.isArray(dstFolders) && dstFolders.length === 0));
    const dstIssue = dstNotFound
      ? null
      : new IssueFolderValidator()
          .set(dstFolders)
          .validateIssueNotNone()
          .validateIssueNotMultiple()
          .first();

    if (dstIssue !== null && srcIssue.issueId === dstIssue.issueId) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "LINK_SELF_REFERENCE",
          message: "Source and destination issue must be different.",
          details: {
            srcFolder: srcIssue.issueId,
            dstFolder: dstIssue.issueId,
          },
        },
      };
      throw response;
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const linkTypes = new TrackerRepoConfigAccessor(
      repo.config,
      globalConfig,
    ).getEffectiveLinkTypes();
    const accessor = LinkageTypesAccessor.fromPairs(linkTypes);
    const lookup = accessor.lookupByFieldName(linkType);
    if (lookup === undefined) {
      const validTypes = accessor.getAllFieldNames();
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "LINK_TYPE_UNKNOWN",
          message: `Unknown link type "${linkType}".`,
          details: { linkType, validTypes },
        },
      };
      throw response;
    }

    const { srcField, dstField } = IssueLinkHelper.resolveFields(
      lookup.pair,
      lookup.side,
    );

    const pattern = new TrackerRepoConfigAccessor(
      repo.config,
      globalConfig,
    ).getEffectiveIssueFilePattern();

    await IssueLinkHelper.ensureIssueFile(srcIssue);

    const srcStorage = new IssueFolderStorage(srcIssue);
    const srcOldMetadata = await IssueLinkHelper.loadFrontmatter(srcIssue);
    const targetName =
      dstIssue?.issueId ??
      IssueFolderLinkFormatter.stripFolderReference(dstSelector);
    const postHookStore = useIssueMetadataChangedPostHookStore.getState();

    if (dstIssue === null) {
      await srcStorage.removeLinkage(srcField, targetName, pattern);
      await srcStorage.touchUpdatedAt();
      const srcNewMetadata = await IssueLinkHelper.loadFrontmatter(srcIssue);
      await postHookStore.notifyMetadataChanged(
        srcIssue,
        srcNewMetadata,
        srcOldMetadata,
      );
      return {
        srcIssue,
        dstIssue: null,
        dstNotFound: true,
        linkType,
        srcField,
        dstField,
      };
    }

    await IssueLinkHelper.ensureIssueFile(dstIssue);
    const dstStorage = new IssueFolderStorage(dstIssue);
    const dstOldMetadata = await IssueLinkHelper.loadFrontmatter(dstIssue);

    if (mode === "link") {
      await srcStorage.applyLinkage(srcField, dstIssue.issueId, pattern);
      await dstStorage.applyLinkage(dstField, srcIssue.issueId, pattern);
    } else {
      await srcStorage.removeLinkage(srcField, targetName, pattern);
      await dstStorage.removeLinkage(dstField, srcIssue.issueId, pattern);
    }

    await srcStorage.touchUpdatedAt();
    await dstStorage.touchUpdatedAt();

    const srcNewMetadata = await IssueLinkHelper.loadFrontmatter(srcIssue);
    const dstNewMetadata = await IssueLinkHelper.loadFrontmatter(dstIssue);
    await postHookStore.notifyMetadataChanged(
      srcIssue,
      srcNewMetadata,
      srcOldMetadata,
    );
    await postHookStore.notifyMetadataChanged(
      dstIssue,
      dstNewMetadata,
      dstOldMetadata,
    );

    return {
      srcIssue,
      dstIssue,
      dstNotFound: false,
      linkType,
      srcField,
      dstField,
    };
  }

  static resolveFields(
    pair: LinkagePair,
    side: "forward" | "reverse",
  ): { srcField: string; dstField: string } {
    if (side === "forward") {
      return { srcField: pair.forward, dstField: pair.reverse };
    }
    return { srcField: pair.reverse, dstField: pair.forward };
  }

  private static async loadFrontmatter(
    issue: IssueFolder,
  ): Promise<Record<string, unknown>> {
    const filePath = await new IssueFolderStorage(issue).findIssueFile();
    if (filePath === undefined) {
      return {};
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    return { ...storage.getParsed().frontmatter };
  }

  private static async ensureIssueFile(issue: IssueFolder): Promise<void> {
    const storage = new IssueFolderStorage(issue);
    const issueFilePath = await storage.findIssueFile();
    if (issueFilePath === undefined) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "ISSUE_MD_MISSING",
          message: `No issue file found in ${issue.path}.`,
          details: { path: issue.path },
        },
      };
      throw response;
    }
  }
}
