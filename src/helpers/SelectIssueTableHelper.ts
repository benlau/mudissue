import type { IssueFolder } from "../types/Issue.ts";
import type { TableColumnDef } from "../types/TableLayout.ts";

const DEFAULT_PROPERTY_COLUMNS = ["status", "priority"] as const;
const FIXED_COLUMNS = ["id", "title"] as const;

const ID_WIDTH = 12;
const STATUS_WIDTH = 12;
const PRIORITY_WIDTH = 10;
const PROPERTY_WIDTH = 12;
const MIN_TITLE_WIDTH = 10;
const COLUMNS_SEPARATOR = ",";

export class SelectIssueTableHelper {
  private readonly propertyColumns: string[];
  private readonly columnKeys: string[];

  constructor(columnsRaw?: string) {
    this.propertyColumns =
      SelectIssueTableHelper.parsePropertyColumns(columnsRaw);
    this.columnKeys = [...FIXED_COLUMNS, ...this.propertyColumns];
  }

  getColumnKeys(): string[] {
    return this.columnKeys;
  }

  getColumnDefs(): TableColumnDef[] {
    return this.columnKeys.map((key) =>
      SelectIssueTableHelper.columnDefForKey(key),
    );
  }

  getHeaderCells(): string[] {
    return this.columnKeys.map((key) => key.toUpperCase());
  }

  getRowCells(issue: IssueFolder): string[] {
    return this.columnKeys.map((key) => this.getCellValue(issue, key));
  }

  getCellValue(issue: IssueFolder, columnKey: string): string {
    switch (columnKey) {
      case "id":
        return issue.label;
      case "title":
        return SelectIssueTableHelper.formatTitle(
          issue.metadata?.title?.trim() || issue.issueId,
        );
      case "status":
        return issue.metadata?.status ?? "";
      case "priority":
        return issue.metadata?.priority ?? "";
      default:
        return (
          SelectIssueTableHelper.formatFrontmatterValue(
            issue.metadata?.frontmatter?.[columnKey],
          ) ?? ""
        );
    }
  }

  static parsePropertyColumns(raw: string | undefined): string[] {
    if (raw === undefined || raw.trim() === "") {
      return [...DEFAULT_PROPERTY_COLUMNS];
    }
    const keys = raw
      .split(COLUMNS_SEPARATOR)
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    return keys.length > 0 ? keys : [...DEFAULT_PROPERTY_COLUMNS];
  }

  private static columnDefForKey(key: string): TableColumnDef {
    switch (key) {
      case "id":
        return { minWidth: ID_WIDTH, maxWidth: ID_WIDTH, grow: 0 };
      case "title":
        return { minWidth: MIN_TITLE_WIDTH, grow: 1 };
      case "status":
        return { minWidth: STATUS_WIDTH, maxWidth: STATUS_WIDTH, grow: 0 };
      case "priority":
        return {
          minWidth: PRIORITY_WIDTH,
          maxWidth: PRIORITY_WIDTH,
          grow: 0,
        };
      default:
        return {
          minWidth: PROPERTY_WIDTH,
          maxWidth: PROPERTY_WIDTH,
          grow: 0,
        };
    }
  }

  private static formatTitle(title: string): string {
    return title.replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "");
  }

  private static formatFrontmatterValue(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      const parts = value
        .map((item) => SelectIssueTableHelper.formatFrontmatterValue(item))
        .filter((item): item is string => item != null);
      return parts.length === 0 ? undefined : parts.join(", ");
    }
    return String(value);
  }
}
