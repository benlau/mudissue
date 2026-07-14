import { IssueSelectorMatcher } from "../../src/foundation/matchers/IssueSelectorMatcher.ts";
import type {
  IssueFolder,
  IssueFolderMetadata,
} from "../../src/types/Issue.ts";

type BuildIssueFolderOverrides = Partial<IssueFolder> &
  Partial<IssueFolderMetadata>;

export function buildIssueFolder(
  issueId: string,
  overrides?: BuildIssueFolderOverrides,
): IssueFolder {
  const label =
    overrides?.label ??
    IssueSelectorMatcher.extractIssueLabel(issueId) ??
    issueId;
  const path = overrides?.path ?? `/tmp/${issueId}`;
  const {
    metadata,
    title,
    status,
    priority,
    createdAt,
    updatedAt,
    ...rest
  } = overrides ?? {};
  const mergedMetadata: IssueFolderMetadata = {
    ...metadata,
    ...(title !== undefined ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
  return {
    issueId,
    label,
    path,
    ...rest,
    ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
  };
}
