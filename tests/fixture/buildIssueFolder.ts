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
  const folderName = overrides?.folderName ?? `${issueId}-sample`;
  const path = overrides?.path ?? `/tmp/${folderName}`;
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
    folderName,
    path,
    ...rest,
    ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
  };
}
