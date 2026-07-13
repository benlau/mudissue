import type { IssueFolder, IssueSortingRules } from "./Issue.ts";
import { accessIssueFolderList } from "./Issue.ts";
import type { PriorityList } from "./priority.ts";
import type { StatusList } from "./status.ts";

export const OTHERS_KANBAN_COLUMN_TITLE = "Others";

export type ObsidianKanbanCard = {
  wikiLink: string;
};

export type ObsidianKanbanColumn = {
  title: string;
  cards: ObsidianKanbanCard[];
};

export type ObsidianKanban = {
  columns: ObsidianKanbanColumn[];
  listCollapse: boolean[];
};

export type CreateObsidianKanbanFromIssuesInput = {
  issues: IssueFolder[];
  statusList: StatusList;
  priorityList: PriorityList;
  resolveIssueFileStem: (folder: IssueFolder) => string;
};

function normalizeStatusKey(value: string | undefined): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  return value.trim().toLowerCase();
}

function buildStatusIndexMap(statusList: StatusList): Map<string, number> {
  const map = new Map<string, number>();
  statusList.forEach((name, index) => {
    const normalized = normalizeStatusKey(name);
    if (normalized != null && !map.has(normalized)) {
      map.set(normalized, index);
    }
  });
  return map;
}

function sortIssuesByPriority(
  issues: IssueFolder[],
  tables: Pick<IssueSortingRules, "statusList" | "priorityList">,
): IssueFolder[] {
  return accessIssueFolderList(issues)
    .sortBy({
      orders: [{ field: "priority", order: "desc" }],
      pinnedFolderNames: [],
      statusList: tables.statusList,
      priorityList: tables.priorityList,
    })
    .get();
}

export class ObsidianKanbanAccessor {
  private data: ObsidianKanban;

  constructor(data: ObsidianKanban) {
    this.data = data;
  }

  get(): ObsidianKanban {
    return this.data;
  }

  static formatCardWikiLink(stem: string): string {
    return `[[${stem}]]`;
  }

  static createFromIssueFolders(
    input: CreateObsidianKanbanFromIssuesInput,
  ): ObsidianKanbanAccessor {
    const { issues, statusList, priorityList, resolveIssueFileStem } = input;

    const statusIndexMap = buildStatusIndexMap(statusList);
    const buckets = statusList.map(() => [] as IssueFolder[]);
    const others: IssueFolder[] = [];

    for (const issue of issues) {
      const normalizedStatus = normalizeStatusKey(issue.metadata?.status);
      const statusIndex =
        normalizedStatus != null
          ? statusIndexMap.get(normalizedStatus)
          : undefined;
      if (statusIndex === undefined) {
        others.push(issue);
      } else {
        buckets[statusIndex]!.push(issue);
      }
    }

    const sortTables = { statusList, priorityList };
    const columns: ObsidianKanbanColumn[] = statusList.map((title, index) => ({
      title,
      cards: sortIssuesByPriority(buckets[index] ?? [], sortTables).map(
        (folder) => ({
          wikiLink: ObsidianKanbanAccessor.formatCardWikiLink(
            resolveIssueFileStem(folder),
          ),
        }),
      ),
    }));

    if (others.length > 0) {
      columns.push({
        title: OTHERS_KANBAN_COLUMN_TITLE,
        cards: sortIssuesByPriority(others, sortTables).map((folder) => ({
          wikiLink: ObsidianKanbanAccessor.formatCardWikiLink(
            resolveIssueFileStem(folder),
          ),
        })),
      });
    }

    return new ObsidianKanbanAccessor({
      columns,
      listCollapse: columns.map(() => false),
    });
  }
}

export function accessObsidianKanban(
  data?: ObsidianKanban,
): ObsidianKanbanAccessor {
  return new ObsidianKanbanAccessor(
    data ?? {
      columns: [],
      listCollapse: [],
    },
  );
}
