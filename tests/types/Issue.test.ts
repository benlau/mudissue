import { DEFAULT_PRIORITY_LIST } from "../../src/types/priority.ts";
import { DEFAULT_STATUS_LIST } from "../../src/types/status.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import {
  accessIssueFolder,
  accessIssueFolderList,
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
