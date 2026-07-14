import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import type { PriorityList } from "./priority.ts";
import {
  DEFAULT_SORTING_ORDER,
  type SortingOrder,
  type SortingOrderField,
} from "./SortingOrder.ts";
import type { StatusList } from "./status.ts";

export type IssueFolderMetadata = {
  /** From frontmatter; set when enriching (e.g. search/view). */
  title?: string;
  /** From frontmatter; set when enriching (e.g. search/view). */
  status?: string;
  /** From frontmatter `priority`; set when enriching (e.g. search/view). */
  priority?: string;
  /** From frontmatter `created_at` when valid, else file/folder birthtime; set when enriching. */
  createdAt?: Date;
  /** From frontmatter `updated_at` when valid, else file/folder mtime; set when enriching. */
  updatedAt?: Date;
  /** Full frontmatter record; set when enriching (e.g. search). */
  frontmatter?: Record<string, unknown>;
};

export type IssueFolder = {
  /** Unique folder basename (PREFIX+NUM+SUFFIX). */
  issueId: string;
  /** Non-unique label (PREFIX+NUM). */
  label: string;
  /** Absolute path of the issue folder. */
  path: string;
  metadata?: IssueFolderMetadata;
};

export type IssueSortingRules = {
  orders: SortingOrder[];
  pinnedIssueIds: readonly string[];
  statusList: StatusList;
  priorityList: PriorityList;
  /** When set, issues whose ID matches this selector sort before others. */
  issueSelector?: string | null;
};

const BUILTIN_SORT_FIELDS = new Set<SortingOrderField>([
  "id",
  "title",
  "status",
  "priority",
  "created_at",
  "updated_at",
]);

function isBuiltinSortField(field: string): field is SortingOrderField {
  return BUILTIN_SORT_FIELDS.has(field as SortingOrderField);
}

export class IssueFolderAccessor {
  private data: IssueFolder;

  constructor(data: IssueFolder) {
    this.data = data;
  }

  mergeMetadata(metadata: IssueFolderMetadata): IssueFolderAccessor {
    this.data = {
      ...this.data,
      metadata: { ...this.data.metadata, ...metadata },
    };
    return this;
  }

  get(): IssueFolder {
    return this.data;
  }
}

export function accessIssueFolder(folder: IssueFolder): IssueFolderAccessor {
  return new IssueFolderAccessor(folder);
}

function normalizeSortKey(value: string | undefined): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  return value.trim().toLowerCase();
}

function buildStatusRankMap(statusList: StatusList): Map<string, number> {
  const ranks = new Map<string, number>();
  statusList.forEach((name, index) => {
    const normalized = normalizeSortKey(name);
    if (normalized != null && !ranks.has(normalized)) {
      ranks.set(normalized, index);
    }
  });
  return ranks;
}

function buildPriorityRankMap(priorityList: PriorityList): Map<string, number> {
  const ranks = new Map<string, number>();
  const maxIndex = Math.max(0, priorityList.length - 1);
  priorityList.forEach((name, index) => {
    const rank = maxIndex - index;
    const normalized = normalizeSortKey(name);
    if (normalized != null && !ranks.has(normalized)) {
      ranks.set(normalized, rank);
    }
  });
  return ranks;
}

function compareDefinedFirst(
  aDefined: boolean,
  bDefined: boolean,
): number | null {
  if (!aDefined && !bDefined) {
    return 0;
  }
  if (!aDefined) {
    return 1;
  }
  if (!bDefined) {
    return -1;
  }
  return null;
}

function frontmatterValueToString(value: unknown): string | undefined {
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
      .map((item) => frontmatterValueToString(item))
      .filter((item): item is string => item != null);
    return parts.length === 0 ? undefined : parts.join(", ");
  }
  return String(value);
}

export class IssueFolderListAccessor {
  private data: IssueFolder[] = [];

  constructor(data: IssueFolder[]) {
    this.data = data;
  }

  sort(): IssueFolderListAccessor {
    this.data.sort((a, b) => b.issueId.localeCompare(a.issueId));
    return this;
  }

  sortByUpdatedAt(): IssueFolderListAccessor {
    return this.sortBy({
      orders: [DEFAULT_SORTING_ORDER],
      pinnedIssueIds: [],
      statusList: [],
      priorityList: [],
    });
  }

  sortBy(rules: IssueSortingRules): IssueFolderListAccessor {
    const { orders, pinnedIssueIds, statusList, priorityList, issueSelector } =
      rules;
    const statusRanks = buildStatusRankMap(statusList);
    const priorityRanks = buildPriorityRankMap(priorityList);

    this.data = [...this.data].sort((a, b) => {
      const idMatch = this.compareByIdMatch(a, b, issueSelector);
      if (idMatch !== 0) {
        return idMatch;
      }
      for (const order of orders) {
        const primary = this.compareByField(
          a,
          b,
          order.field,
          statusRanks,
          priorityRanks,
          order.order,
        );
        if (primary !== 0) {
          return primary;
        }
      }
      return a.issueId.localeCompare(b.issueId);
    });

    if (pinnedIssueIds.length === 0) {
      return this;
    }

    const pinnedSet = new Set(pinnedIssueIds);
    const byIssueId = new Map(
      this.data.map((item) => [item.issueId, item] as const),
    );
    const pinned: IssueFolder[] = [];
    for (const issueId of pinnedIssueIds) {
      const item = byIssueId.get(issueId);
      if (item != null) {
        pinned.push(item);
      }
    }
    const unpinned = this.data.filter((item) => !pinnedSet.has(item.issueId));
    this.data = [...pinned, ...unpinned];
    return this;
  }

  private compareByIdMatch(
    a: IssueFolder,
    b: IssueFolder,
    filter?: string | null,
  ): number {
    if (filter == null || filter.trim() === "") {
      return 0;
    }
    const trimmedFilter = filter.trim();
    const aMatches = IssueSelectorMatcher.match(a.issueId, trimmedFilter);
    const bMatches = IssueSelectorMatcher.match(b.issueId, trimmedFilter);
    if (aMatches && !bMatches) {
      return -1;
    }
    if (!aMatches && bMatches) {
      return 1;
    }
    return 0;
  }

  private compareByField(
    a: IssueFolder,
    b: IssueFolder,
    field: SortingOrder["field"],
    statusRanks: Map<string, number>,
    priorityRanks: Map<string, number>,
    order: SortingOrder["order"],
  ): number {
    if (!isBuiltinSortField(field)) {
      const aValue = frontmatterValueToString(a.metadata?.frontmatter?.[field]);
      const bValue = frontmatterValueToString(b.metadata?.frontmatter?.[field]);
      return this.compareStrings(aValue, bValue, false, order);
    }

    switch (field) {
      case "id":
        return this.compareStrings(a.issueId, b.issueId, true, order);
      case "title":
        return this.compareStrings(
          a.metadata?.title,
          b.metadata?.title,
          false,
          order,
        );
      case "status":
        return this.compareRanks(
          statusRanks.get(normalizeSortKey(a.metadata?.status) ?? ""),
          statusRanks.get(normalizeSortKey(b.metadata?.status) ?? ""),
          a.metadata?.status,
          b.metadata?.status,
          order,
        );
      case "priority":
        return this.compareRanks(
          priorityRanks.get(normalizeSortKey(a.metadata?.priority) ?? ""),
          priorityRanks.get(normalizeSortKey(b.metadata?.priority) ?? ""),
          a.metadata?.priority,
          b.metadata?.priority,
          order,
        );
      case "created_at":
        return this.compareDates(
          a.metadata?.createdAt,
          b.metadata?.createdAt,
          order,
        );
      case "updated_at":
        return this.compareDates(
          a.metadata?.updatedAt,
          b.metadata?.updatedAt,
          order,
        );
      default:
        return 0;
    }
  }

  private compareStrings(
    a: string | undefined,
    b: string | undefined,
    required: boolean,
    order: SortingOrder["order"] = "asc",
  ): number {
    const aDefined = required || normalizeSortKey(a) != null;
    const bDefined = required || normalizeSortKey(b) != null;
    const definedFirst = compareDefinedFirst(aDefined, bDefined);
    if (definedFirst != null) {
      return definedFirst;
    }
    const compared = (a ?? "").localeCompare(b ?? "", undefined, {
      sensitivity: "base",
    });
    return order === "desc" ? -compared : compared;
  }

  private compareRanks(
    aRank: number | undefined,
    bRank: number | undefined,
    aRaw: string | undefined,
    bRaw: string | undefined,
    order: SortingOrder["order"],
  ): number {
    const aDefined = aRank !== undefined;
    const bDefined = bRank !== undefined;
    const definedFirst = compareDefinedFirst(aDefined, bDefined);
    if (definedFirst != null) {
      return definedFirst;
    }
    if (aRank !== bRank) {
      const compared = (aRank ?? 0) - (bRank ?? 0);
      return order === "desc" ? -compared : compared;
    }
    const compared = (aRaw ?? "").localeCompare(bRaw ?? "", undefined, {
      sensitivity: "base",
    });
    return order === "desc" ? -compared : compared;
  }

  private compareDates(
    a: Date | undefined,
    b: Date | undefined,
    order: SortingOrder["order"] = "asc",
  ): number {
    const aDefined = a != null;
    const bDefined = b != null;
    const definedFirst = compareDefinedFirst(aDefined, bDefined);
    if (definedFirst != null) {
      return definedFirst;
    }
    const compared = (a?.getTime() ?? 0) - (b?.getTime() ?? 0);
    return order === "desc" ? -compared : compared;
  }

  updateMetadata(
    issueId: string,
    metadata: IssueFolderMetadata,
  ): IssueFolderListAccessor {
    this.data = this.data.map((item) =>
      item.issueId === issueId
        ? { ...item, metadata: { ...item.metadata, ...metadata } }
        : item,
    );
    return this;
  }

  get(): IssueFolder[] {
    return this.data;
  }
}

export function accessIssueFolderList(
  folder: IssueFolder[],
): IssueFolderListAccessor {
  return new IssueFolderListAccessor(folder);
}

export type ProjectIssueFolders = {
  name: string;
  projectPath: string;
  issues: IssueFolder[];
};
