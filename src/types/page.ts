import type { IssueFolder } from "./Issue.ts";

export type IssueTablePage = {
  name: "ISSUE_TABLE";
};

export type IssueViewerPage = {
  name: "ISSUE_VIEWER";
  args: {
    issue: IssueFolder;
    project?: string;
    /** Absolute path to an attachment file opened instead of the issue markdown. */
    attachmentPath?: string;
  };
};

export type Page = IssueTablePage | IssueViewerPage;

export const ISSUE_TABLE_PAGE: IssueTablePage = { name: "ISSUE_TABLE" };
