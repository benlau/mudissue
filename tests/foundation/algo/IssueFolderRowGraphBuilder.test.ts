import { IssueFolderRowGraphBuilder } from "../../../src/foundation/algo/IssueFolderRowGraphBuilder.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

describe("IssueFolderRowGraphBuilder", () => {
  it("keeps issue 4 as a root when issue 3 has two parents (playground layout)", () => {
    const one = buildIssueFolder("0001-1", {
      metadata: { frontmatter: { subissues: ["[[0002-2]]"] } },
    });
    const two = buildIssueFolder("0002-2", {
      metadata: {
        frontmatter: {
          parent: "[[0001-1]]",
          subissues: ["[[0003-3]]"],
        },
      },
    });
    const three = buildIssueFolder("0003-3", {
      metadata: {
        frontmatter: {
          parent: ["[[0002-2]]", "[[0004-4]]"],
        },
      },
    });
    const four = buildIssueFolder("0004-4", {
      metadata: { frontmatter: { subissues: ["[[0003-3]]"] } },
    });

    const resolved = new IssueFolderRowGraphBuilder()
      .build([one, two, three, four])
      .normalize()
      .sortAndSetDepth()
      .get();
    const depthById = new Map(
      resolved.nodes.map((node) => [
        node.data.issueFolder.issueId,
        node.data.depth,
      ]),
    );

    expect(depthById.get("0001-1")).toBe(0);
    expect(depthById.get("0002-2")).toBe(1);
    expect(depthById.get("0003-3")).toBe(2);
    expect(depthById.get("0004-4")).toBe(0);
  });

  it("picks the earliest created issue as root when parent links form a cycle", () => {
    const later = buildIssueFolder("MI0002", {
      metadata: {
        frontmatter: {
          parent: "[[MI0001]]",
          subissues: ["[[MI0001]]"],
        },
      },
      createdAt: new Date("2026-02-01"),
    });
    const earlier = buildIssueFolder("MI0001", {
      metadata: {
        frontmatter: {
          parent: "[[MI0002]]",
          subissues: ["[[MI0002]]"],
        },
      },
      createdAt: new Date("2026-01-01"),
    });

    const rows = new IssueFolderRowGraphBuilder()
      .build([later, earlier])
      .normalize()
      .sortAndSetDepth()
      .toIssueFolderRows();

    expect(rows.map((row) => row.issueFolder.issueId)).toEqual([
      "MI0001",
      "MI0002",
    ]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1]);
  });
});
