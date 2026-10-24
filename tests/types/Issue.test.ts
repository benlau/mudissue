import { DEFAULT_PRIORITY_LIST } from "../../src/types/priority.ts";
import { DEFAULT_STATUS_LIST } from "../../src/types/status.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import {
  accessIssueFolder,
  accessIssueFolderList,
  IssueFolderRowListAccessor,
} from "../../src/types/Issue.ts";
import { DEFAULT_SORTING_ORDER } from "../../src/types/SortingOrder.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

const defaultSortingRules = {
  orders: [DEFAULT_SORTING_ORDER],
  pinnedIssueIds: [],
  statusList: DEFAULT_STATUS_LIST,
  priorityList: DEFAULT_PRIORITY_LIST,
};

function buildIssue(
  issueId: string,
  overrides?: Parameters<typeof buildIssueFolder>[1],
): IssueFolder {
  return buildIssueFolder(issueId, overrides);
}

describe("IssueFolderAccessor", () => {
  it("mergeMetadata returns updated issue via get", () => {
    const issue = buildIssue("MI0001", {
      title: "Old",
      status: "open",
    });

    const updated = accessIssueFolder(issue)
      .mergeMetadata({
        title: "New",
        status: "closed",
        priority: "high",
        updatedAt: new Date("2026-01-02"),
      })
      .get();

    expect(updated).toEqual({
      ...issue,
      metadata: {
        title: "New",
        status: "closed",
        priority: "high",
        updatedAt: new Date("2026-01-02"),
      },
    });
    expect(issue.metadata?.title).toBe("Old");
  });
});

describe("IssueFolderListAccessor", () => {
  it("sortByUpdatedAt orders newest updatedAt first", () => {
    const older = buildIssue("MI0001", {
      updatedAt: new Date("2026-01-01"),
    });
    const newer = buildIssue("MI0002", {
      updatedAt: new Date("2026-01-03"),
    });
    const middle = buildIssue("MI0003", {
      updatedAt: new Date("2026-01-02"),
    });

    const sorted = accessIssueFolderList([older, newer, middle])
      .sortByUpdatedAt()
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0002",
      "MI0003",
      "MI0001",
    ]);
  });

  it("updateMetadata patches matching issue only", () => {
    const first = buildIssue("MI0001", { title: "A", status: "open" });
    const second = buildIssue("MI0002", { title: "B", status: "open" });

    const result = accessIssueFolderList([first, second])
      .updateMetadata("MI0001", {
        title: "A revised",
        status: "done",
        priority: "low",
        updatedAt: new Date("2026-05-01"),
      })
      .get();

    expect(result[0]).toMatchObject({
      issueId: "MI0001",
      metadata: {
        title: "A revised",
        status: "done",
        priority: "low",
      },
    });
    expect(result[1]).toEqual(second);
  });

  it("chains updateMetadata and sortByUpdatedAt", () => {
    const a = buildIssue("MI0001", {
      title: "A",
      updatedAt: new Date("2026-01-01"),
    });
    const b = buildIssue("MI0002", {
      title: "B",
      updatedAt: new Date("2026-01-05"),
    });

    const result = accessIssueFolderList([a, b])
      .updateMetadata("MI0001", {
        title: "A revised",
        status: "open",
        updatedAt: new Date("2026-06-01"),
      })
      .sortByUpdatedAt()
      .get();

    expect(result.map((i) => i.issueId)).toEqual(["MI0001", "MI0002"]);
    expect(result[0]?.metadata?.title).toBe("A revised");
  });

  it("sortBy id asc orders lowest id first", () => {
    const a = buildIssue("MI0002");
    const b = buildIssue("MI0001");

    const sorted = accessIssueFolderList([a, b])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "id", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual(["MI0001", "MI0002"]);
  });

  it("sortBy title asc places issues without title last", () => {
    const withTitle = buildIssue("MI0001", { title: "Alpha" });
    const withoutTitle = buildIssue("MI0002");
    const beta = buildIssue("MI0003", { title: "Beta" });

    const sorted = accessIssueFolderList([withoutTitle, beta, withTitle])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "title", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0001",
      "MI0003",
      "MI0002",
    ]);
  });

  it("sortBy status uses workflow order from status table", () => {
    const done = buildIssue("MI0001", { status: "closed" });
    const open = buildIssue("MI0002", { status: "open" });
    const inProgress = buildIssue("MI0003", { status: "in_progress" });

    const sorted = accessIssueFolderList([done, inProgress, open])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "status", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0002",
      "MI0003",
      "MI0001",
    ]);
  });

  it("sortBy priority desc orders highest priority first", () => {
    const low = buildIssue("MI0001", { priority: "low" });
    const urgent = buildIssue("MI0002", { priority: "urgent" });
    const medium = buildIssue("MI0003", { priority: "medium" });

    const sorted = accessIssueFolderList([low, medium, urgent])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "priority", order: "desc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0002",
      "MI0003",
      "MI0001",
    ]);
  });

  it("sortBy priority desc places unset and unknown priorities last", () => {
    const highMediumLowList = ["high", "medium", "low"];
    const low = buildIssue("MI0001", { priority: "low" });
    const high = buildIssue("MI0002", { priority: "high" });
    const unset = buildIssue("MI0003");
    const medium = buildIssue("MI0004", { priority: "medium" });
    const unknown = buildIssue("MI0005", { priority: "critical" });

    const sorted = accessIssueFolderList([low, high, unset, medium, unknown])
      .sortBy({
        ...defaultSortingRules,
        priorityList: highMediumLowList,
        orders: [{ field: "priority", order: "desc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0002",
      "MI0004",
      "MI0001",
      "MI0003",
      "MI0005",
    ]);
  });

  it("sortBy created_at desc orders newest createdAt first", () => {
    const older = buildIssue("MI0001", {
      createdAt: new Date("2026-01-01"),
    });
    const newer = buildIssue("MI0002", {
      createdAt: new Date("2026-02-01"),
    });

    const sorted = accessIssueFolderList([older, newer])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "created_at", order: "desc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual(["MI0002", "MI0001"]);
  });

  it("sortBy updated_at asc orders oldest updatedAt first", () => {
    const newer = buildIssue("MI0001", {
      updatedAt: new Date("2026-02-01"),
    });
    const older = buildIssue("MI0002", {
      updatedAt: new Date("2026-01-01"),
    });

    const sorted = accessIssueFolderList([newer, older])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "updated_at", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual(["MI0002", "MI0001"]);
  });

  it("sortBy places pinned issues first in registry order", () => {
    const a = buildIssue("MI0001-a", {
      updatedAt: new Date("2026-03-01"),
    });
    const b = buildIssue("MI0002-b", {
      updatedAt: new Date("2026-02-01"),
    });
    const c = buildIssue("MI0003-c", {
      updatedAt: new Date("2026-01-01"),
    });

    const sorted = accessIssueFolderList([a, b, c])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "updated_at", order: "desc" }],
        pinnedIssueIds: ["MI0003-c", "MI0001-a"],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0003-c",
      "MI0001-a",
      "MI0002-b",
    ]);
  });

  it("sortBy applies multiple orders in sequence", () => {
    const alphaOld = buildIssue("MI0001", {
      title: "Alpha",
      createdAt: new Date("2026-01-01"),
    });
    const alphaNew = buildIssue("MI0002", {
      title: "Alpha",
      createdAt: new Date("2026-02-01"),
    });
    const beta = buildIssue("MI0003", {
      title: "Beta",
      createdAt: new Date("2026-03-01"),
    });

    const sorted = accessIssueFolderList([alphaOld, beta, alphaNew])
      .sortBy({
        ...defaultSortingRules,
        orders: [
          { field: "title", order: "asc" },
          { field: "created_at", order: "desc" },
        ],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0002",
      "MI0001",
      "MI0003",
    ]);
  });

  it("sortBy custom frontmatter field asc places missing values last", () => {
    const withAssignee = buildIssue("MI0001", {
      metadata: { frontmatter: { assignee: "alice" } },
    });
    const withoutAssignee = buildIssue("MI0002");
    const otherAssignee = buildIssue("MI0003", {
      metadata: { frontmatter: { assignee: "bob" } },
    });

    const sorted = accessIssueFolderList([
      withoutAssignee,
      otherAssignee,
      withAssignee,
    ])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "assignee", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0001",
      "MI0003",
      "MI0002",
    ]);
  });

  it("sortBy custom frontmatter field desc still places missing values last", () => {
    const withAssignee = buildIssue("MI0001", {
      metadata: { frontmatter: { assignee: "alice" } },
    });
    const withoutAssignee = buildIssue("MI0002");
    const otherAssignee = buildIssue("MI0003", {
      metadata: { frontmatter: { assignee: "bob" } },
    });

    const sorted = accessIssueFolderList([
      withoutAssignee,
      withAssignee,
      otherAssignee,
    ])
      .sortBy({
        ...defaultSortingRules,
        orders: [{ field: "assignee", order: "desc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "MI0003",
      "MI0001",
      "MI0002",
    ]);
  });

  it("sortBy issueSelector promotes exact issue id matches before other sort orders", () => {
    const exactMatch = buildIssue("0067-issue");
    const partialNumber = buildIssue("0167-other");
    const unrelated = buildIssue("0001-alpha");

    const sorted = accessIssueFolderList([partialNumber, unrelated, exactMatch])
      .sortBy({
        ...defaultSortingRules,
        issueSelector: "67",
        orders: [{ field: "id", order: "desc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual([
      "0067-issue",
      "0167-other",
      "0001-alpha",
    ]);
  });

  it("sortBy issueSelector does not reorder when filter is not an issue selector", () => {
    const alpha = buildIssue("0001-alpha");
    const beta = buildIssue("0002-beta");

    const sorted = accessIssueFolderList([beta, alpha])
      .sortBy({
        ...defaultSortingRules,
        issueSelector: "bug",
        orders: [{ field: "id", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual(["0001-alpha", "0002-beta"]);
  });

  it("sortBy issueSelector does not reorder when filter is empty", () => {
    const alpha = buildIssue("0001");
    const beta = buildIssue("0002");

    const sorted = accessIssueFolderList([beta, alpha])
      .sortBy({
        ...defaultSortingRules,
        issueSelector: "",
        orders: [{ field: "id", order: "asc" }],
      })
      .get();

    expect(sorted.map((i) => i.issueId)).toEqual(["0001", "0002"]);
  });
});

describe("groupByParentSubissue", () => {
  function linkedIssue(
    issueId: string,
    frontmatter: Record<string, unknown>,
    overrides?: Parameters<typeof buildIssue>[1],
  ): IssueFolder {
    return buildIssue(issueId, {
      ...overrides,
      metadata: { frontmatter },
    });
  }

  it("places each subissue under its parent with depth", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]", "[[MI0003]]"] },
      {
        title: "Parent",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const firstChild = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        title: "Beta",
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-03"),
      },
    );
    const secondChild = linkedIssue(
      "MI0003",
      { parent: "[[MI0001]]" },
      {
        title: "Alpha",
        createdAt: new Date("2026-01-03"),
        updatedAt: new Date("2026-01-02"),
      },
    );

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      secondChild,
      parent,
      firstChild,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "title", order: "asc" }],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0001",
      "MI0003",
      "MI0002",
    ]);
    expect(grouped.map((issue) => issue.depth)).toEqual([0, 1, 1]);
  });

  it("nests an older child under a parent that was created later", () => {
    const parent = linkedIssue(
      "MZ0029",
      { subissues: ["[[MI0536]]"] },
      {
        title: "v0.0.6 release",
        createdAt: new Date("2026-02-01"),
      },
    );
    const child = linkedIssue(
      "MI0536",
      { parent: "[[MZ0029]]" },
      {
        title: "Dependency Alerts",
        createdAt: new Date("2026-01-01"),
      },
    );

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      child,
      parent,
    ])
      .sortBy(defaultSortingRules, { groupByParentSubissue: true })
      .get();

    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MZ0029",
      "MI0536",
    ]);
    expect(grouped.map((issue) => issue.depth)).toEqual([0, 1]);
  });

  it("nests a grandchild under its parent instead of beside it", () => {
    const root = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        title: "A",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]", subissues: ["[[MI0003]]"] },
      {
        title: "B",
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-02"),
      },
    );
    const grandchild = linkedIssue(
      "MI0003",
      { parent: "[[MI0002]]" },
      {
        title: "C",
        createdAt: new Date("2026-01-03"),
        updatedAt: new Date("2026-01-03"),
      },
    );

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      grandchild,
      root,
      child,
    ])
      .sortBy(defaultSortingRules, { groupByParentSubissue: true })
      .get();

    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0001",
      "MI0002",
      "MI0003",
    ]);
    expect(grouped.map((issue) => issue.depth)).toEqual([0, 1, 2]);
  });

  it("sorts updated_at oldest-first by the latest date in the family", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-03-01"),
      },
    );
    const other = buildIssue("MI0003", {
      updatedAt: new Date("2026-02-01"),
    });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      parent,
      child,
      other,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "updated_at", order: "asc" }],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0003",
      "MI0001",
      "MI0002",
    ]);
  });

  it("sorts updated_at youngest-first by the earliest date in the family", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-03-01"),
      },
    );
    const other = buildIssue("MI0003", {
      updatedAt: new Date("2026-02-01"),
    });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      child,
      other,
      parent,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "updated_at", order: "desc" }],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0003",
      "MI0001",
      "MI0002",
    ]);
  });

  it("sorts created_at oldest-first by the latest created date in the family", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-04-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        createdAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const other = buildIssue("MI0003", {
      createdAt: new Date("2026-02-01"),
    });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      parent,
      child,
      other,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "created_at", order: "asc" }],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0003",
      "MI0001",
      "MI0002",
    ]);
  });

  it("sorts by the parent title and status", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        title: "Zebra",
        status: "closed",
        createdAt: new Date("2026-01-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        title: "Alpha",
        status: "open",
        createdAt: new Date("2026-01-02"),
      },
    );
    const other = buildIssue("MI0003", {
      title: "Middle",
      status: "open",
    });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      child,
      other,
      parent,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "title", order: "asc" }],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0003",
      "MI0001",
      "MI0002",
    ]);
    expect(grouped[2]?.issueFolder.metadata?.title).toBe("Alpha");
    expect(grouped[2]?.issueFolder.metadata?.status).toBe("open");
  });

  it("moves the whole group to the top when a child is pinned", () => {
    const parent = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      {
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    );
    const child = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      {
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-02"),
      },
    );
    const other = buildIssue("MI0003", {
      updatedAt: new Date("2026-03-01"),
    });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      other,
      child,
      parent,
    ])
      .sortBy(
        {
          ...defaultSortingRules,
          orders: [{ field: "updated_at", order: "desc" }],
          pinnedIssueIds: ["MI0002"],
        },
        { groupByParentSubissue: true },
      )
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0001",
      "MI0002",
      "MI0003",
    ]);
    expect(grouped.map((issue) => issue.depth)).toEqual([0, 1, 0]);
  });

  it("picks the earliest created issue as root when the link is cyclic", () => {
    const later = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]", subissues: ["[[MI0001]]"] },
      {
        title: "Later",
        createdAt: new Date("2026-02-01"),
      },
    );
    const earlier = linkedIssue(
      "MI0001",
      { parent: "[[MI0002]]", subissues: ["[[MI0002]]"] },
      {
        title: "Earlier",
        createdAt: new Date("2026-01-01"),
      },
    );

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      later,
      earlier,
    ])
      .sortBy(defaultSortingRules, { groupByParentSubissue: true })
      .get();
    expect(grouped.map((issue) => issue.issueFolder.issueId)).toEqual([
      "MI0001",
      "MI0002",
    ]);
    expect(grouped.map((issue) => issue.depth)).toEqual([0, 1]);
  });

  it("shows a second root when multi-parent links would merge unrelated trees", () => {
    const one = linkedIssue("0001-1", { subissues: ["[[0002-2]]"] });
    const two = linkedIssue("0002-2", {
      parent: "[[0001-1]]",
      subissues: ["[[0003-3]]"],
    });
    const three = linkedIssue("0003-3", {
      parent: ["[[0002-2]]", "[[0004-4]]"],
    });
    const four = linkedIssue("0004-4", { subissues: ["[[0003-3]]"] });

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      four,
      three,
      two,
      one,
    ])
      .sortBy(defaultSortingRules, { groupByParentSubissue: true })
      .get();

    expect(grouped.map((row) => row.issueFolder.issueId)).toEqual([
      "0001-1",
      "0002-2",
      "0003-3",
      "0004-4",
    ]);
    expect(grouped.map((row) => row.depth)).toEqual([0, 1, 2, 0]);
  });

  it("breaks a created_at tie by issue id", () => {
    const createdAt = new Date("2026-01-01");
    const higherId = linkedIssue(
      "MI0002",
      { parent: "[[MI0001]]" },
      { title: "Alpha", createdAt },
    );
    const lowerId = linkedIssue(
      "MI0001",
      { subissues: ["[[MI0002]]"] },
      { title: "Zebra", createdAt },
    );

    const grouped = IssueFolderRowListAccessor.createFromIssueFolderList([
      higherId,
      lowerId,
    ])
      .sortBy(defaultSortingRules, { groupByParentSubissue: true })
      .get();
    expect(grouped[0]?.issueFolder.issueId).toBe("MI0001");
    expect(grouped[1]?.depth).toBe(1);
  });
});
