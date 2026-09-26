import type { ErrorResponse } from "../../types/Response.ts";
import type { IssueFolder } from "../../types/Issue.ts";

export class IssueFolderValidator {
  private data: IssueFolder | IssueFolder[] | undefined | null = undefined;

  constructor() {}

  set(value: IssueFolder | IssueFolder[] | undefined | null): this {
    this.data = value;
    return this;
  }

  validateIssueNotNone(): this {
    const empty =
      this.data == null || (Array.isArray(this.data) && this.data.length === 0);
    if (empty) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "ISSUE_NOT_FOUND",
          message: "Issue not found",
        },
      };
      throw response;
    }
    return this;
  }

  validateIssueNotMultiple(): this {
    if (Array.isArray(this.data) && this.data.length > 1) {
      const folderNames = this.data.map((folder) => folder.issueId).join(" , ");

      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "ISSUE_MULTI_MATCHED",
          message: `Multiple issues matched: ${folderNames}`,
        },
      };
      throw response;
    }
    return this;
  }

  first(): IssueFolder {
    if (Array.isArray(this.data)) {
      return this.data[0];
    }
    return this.data as IssueFolder;
  }
}
