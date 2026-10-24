import { IssueFolderRowGraphBuilder } from "../foundation/algo/IssueFolderRowGraphBuilder.ts";
import { accessDirectedGraph, type DirectedGraph } from "./DirectedGraph.ts";
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

export type IssueFolderRow = {
  issueFolder: IssueFolder;
  /** Nesting level in the issue table. `0` is a root row. */
  depth: number;
};

export class IssueFolderRowAccessor {
  private data: IssueFolderRow;

  constructor(data: IssueFolderRow) {
    this.data = data;
  }

  get(): IssueFolderRow {
    return this.data;
  }
}

export function accessIssueFolderRow(
  issueFolder: IssueFolder,
  depth = 0,
): IssueFolderRowAccessor {
  return new IssueFolderRowAccessor({ issueFolder, depth });
}

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

type ParentSubissueGroup = {
  root: IssueFolder;
  children: IssueFolder[];
};

function aggregateFamilyDate(
  members: IssueFolder[],
  key: "createdAt" | "updatedAt",
  order: SortingOrder["order"],
): Date | undefined {
  const dates = members
    .map((member) => member.metadata?.[key])
    .filter(
      (date): date is Date => date != null && !Number.isNaN(date.getTime()),
    );
  if (dates.length === 0) {
    return undefined;
  }
  return dates.reduce((selected, date) => {
    if (order === "asc") {
      return date.getTime() > selected.getTime() ? date : selected;
    }
    return date.getTime() < selected.getTime() ? date : selected;
  });
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

function compareIssueFoldersByIdMatch(
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

function compareIssueStrings(
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

function compareIssueRanks(
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

function compareIssueDates(
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

function compareIssueFoldersByField(
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
    return compareIssueStrings(aValue, bValue, false, order);
  }

  switch (field) {
    case "id":
      return compareIssueStrings(a.issueId, b.issueId, true, order);
    case "title":
      return compareIssueStrings(
        a.metadata?.title,
        b.metadata?.title,
        false,
        order,
      );
    case "status":
      return compareIssueRanks(
        statusRanks.get(normalizeSortKey(a.metadata?.status) ?? ""),
        statusRanks.get(normalizeSortKey(b.metadata?.status) ?? ""),
        a.metadata?.status,
        b.metadata?.status,
        order,
      );
    case "priority":
      return compareIssueRanks(
        priorityRanks.get(normalizeSortKey(a.metadata?.priority) ?? ""),
        priorityRanks.get(normalizeSortKey(b.metadata?.priority) ?? ""),
        a.metadata?.priority,
        b.metadata?.priority,
        order,
      );
    case "created_at":
      return compareIssueDates(
        a.metadata?.createdAt,
        b.metadata?.createdAt,
        order,
      );
    case "updated_at":
      return compareIssueDates(
        a.metadata?.updatedAt,
        b.metadata?.updatedAt,
        order,
      );
    default:
      return 0;
  }
}

function partitionParentSubissueGroups(
  issues: IssueFolder[],
  resolved: DirectedGraph<IssueFolderRow>,
): ParentSubissueGroup[] {
  const byPath = new Map(issues.map((issue) => [issue.path, issue] as const));
  const graph = accessDirectedGraph(resolved);
  return graph.roots().map((rootNode) => {
    const root = byPath.get(rootNode.id) ?? rootNode.data.issueFolder;
    const descendantPaths = graph.collectDescendantIds(rootNode.id);
    const children = descendantPaths
      .map((path) => byPath.get(path))
      .filter((issue): issue is IssueFolder => issue != null);
    return { root, children };
  });
}

function groupSortStandIn(
  group: ParentSubissueGroup,
  order: SortingOrder,
): IssueFolder {
  if (order.field !== "updated_at" && order.field !== "created_at") {
    return group.root;
  }
  const key = order.field === "updated_at" ? "updatedAt" : "createdAt";
  const aggregated = aggregateFamilyDate(
    [group.root, ...group.children],
    key,
    order.order,
  );
  return {
    ...group.root,
    metadata: { ...group.root.metadata, [key]: aggregated },
  };
}

function orderParentSubissueGroups(
  groups: ParentSubissueGroup[],
  rules: IssueSortingRules,
): ParentSubissueGroup[] {
  const statusRanks = buildStatusRankMap(rules.statusList);
  const priorityRanks = buildPriorityRankMap(rules.priorityList);
  return [...groups].sort((left, right) => {
    const idMatch = compareIssueFoldersByIdMatch(
      left.root,
      right.root,
      rules.issueSelector,
    );
    if (idMatch !== 0) {
      return idMatch;
    }
    for (const order of rules.orders) {
      const compared = compareIssueFoldersByField(
        groupSortStandIn(left, order),
        groupSortStandIn(right, order),
        order.field,
        statusRanks,
        priorityRanks,
        order.order,
      );
      if (compared !== 0) {
        return compared;
      }
    }
    return left.root.issueId.localeCompare(right.root.issueId);
  });
}

function pinParentSubissueGroups(
  groups: ParentSubissueGroup[],
  pinnedIssueIds: readonly string[],
): ParentSubissueGroup[] {
  if (pinnedIssueIds.length === 0) {
    return groups;
  }
  const rootByMemberId = new Map<string, string>();
  for (const group of groups) {
    rootByMemberId.set(group.root.issueId, group.root.issueId);
    for (const child of group.children) {
      rootByMemberId.set(child.issueId, group.root.issueId);
    }
  }
  const pinnedRootIds: string[] = [];
  const seenRootIds = new Set<string>();
  for (const issueId of pinnedIssueIds) {
    const rootId = rootByMemberId.get(issueId);
    if (rootId == null || seenRootIds.has(rootId)) {
      continue;
    }
    seenRootIds.add(rootId);
    pinnedRootIds.push(rootId);
  }
  const byRootId = new Map(
    groups.map((group) => [group.root.issueId, group] as const),
  );
  const pinned = pinnedRootIds
    .map((rootId) => byRootId.get(rootId))
    .filter((group): group is ParentSubissueGroup => group != null);
  const unpinned = groups.filter(
    (group) => !seenRootIds.has(group.root.issueId),
  );
  return [...pinned, ...unpinned];
}

function resolvedChildFolders(
  parentPath: string,
  resolved: DirectedGraph<IssueFolderRow>,
  rules: IssueSortingRules,
): IssueFolder[] {
  const graph = accessDirectedGraph(resolved);
  const children = graph
    .childIds(parentPath)
    .map((childPath) => graph.getNode(childPath)?.data.issueFolder)
    .filter((issue): issue is IssueFolder => issue != null);
  return new IssueFolderListAccessor(children)
    .sortBy({ ...rules, pinnedIssueIds: [] })
    .get();
}

function flattenParentSubissueGroup(
  group: ParentSubissueGroup,
  resolved: DirectedGraph<IssueFolderRow>,
  rules: IssueSortingRules,
): IssueFolderRow[] {
  const graph = accessDirectedGraph(resolved);
  const rows: IssueFolderRow[] = [];
  const seen = new Set<string>();

  const walk = (issuePath: string) => {
    if (seen.has(issuePath)) {
      return;
    }
    seen.add(issuePath);
    const node = graph.getNode(issuePath);
    if (node == null) {
      return;
    }
    rows.push(node.data);
    for (const child of resolvedChildFolders(issuePath, resolved, rules)) {
      walk(child.path);
    }
  };

  walk(group.root.path);
  return rows;
}

function groupIssueFoldersByParentSubissue(
  issues: IssueFolder[],
  rules: IssueSortingRules,
): IssueFolderRow[] {
  const resolved = new IssueFolderRowGraphBuilder()
    .build(issues)
    .normalize()
    .sortAndSetDepth()
    .get();
  const groups = partitionParentSubissueGroups(issues, resolved);
  const ordered = orderParentSubissueGroups(groups, rules);
  const pinned = pinParentSubissueGroups(ordered, rules.pinnedIssueIds);
  return pinned.flatMap((group) =>
    flattenParentSubissueGroup(group, resolved, rules),
  );
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
      const idMatch = compareIssueFoldersByIdMatch(a, b, issueSelector);
      if (idMatch !== 0) {
        return idMatch;
      }
      for (const order of orders) {
        const primary = compareIssueFoldersByField(
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

  toIssueFolderRows(): IssueFolderRow[] {
    return this.data.map((issueFolder) =>
      accessIssueFolderRow(issueFolder).get(),
    );
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

export type IssueFolderRowSortOptions = {
  groupByParentSubissue: boolean;
};

export class IssueFolderRowListAccessor {
  private data: IssueFolderRow[] = [];

  private constructor(data: IssueFolderRow[]) {
    this.data = data;
  }

  static createFromIssueFolderList(
    issues: IssueFolder[],
  ): IssueFolderRowListAccessor {
    return new IssueFolderRowListAccessor(
      issues.map((issueFolder) => accessIssueFolderRow(issueFolder).get()),
    );
  }

  sortBy(
    rules: IssueSortingRules,
    options: IssueFolderRowSortOptions,
  ): IssueFolderRowListAccessor {
    const folders = this.data.map((row) => row.issueFolder);
    this.data = options.groupByParentSubissue
      ? groupIssueFoldersByParentSubissue(folders, rules)
      : accessIssueFolderList(folders).sortBy(rules).toIssueFolderRows();
    return this;
  }

  get(): IssueFolderRow[] {
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
