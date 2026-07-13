import { GitBranchFormatter } from "../../../src/foundation/formatter/GitBranchFormatter.ts";

describe("GitBranchFormatter", () => {
  describe("normalize", () => {
    it("keeps already valid branch names unchanged", () => {
      expect(
        GitBranchFormatter.normalize(
          "feature/MI0089-mi-issue-branch-create",
          "MI0089",
        ),
      ).toBe("feature/MI0089-mi-issue-branch-create");
    });

    it("replaces invalid Git ref characters with dashes", () => {
      expect(
        GitBranchFormatter.normalize(
          "feature/MI0089:fix bug?*[draft]\\name~next^1",
          "MI0089",
        ),
      ).toBe("feature/MI0089-fix-bug-draft-name-next-1");
    });

    it("replaces ampersand in branch material", () => {
      expect(
        GitBranchFormatter.normalize("MI0010-a&b", "MI0010"),
      ).toBe("MI0010-a-b");
    });

    it("normalizes invalid Git ref patterns", () => {
      expect(
        GitBranchFormatter.normalize(
          "/feature//.hidden/bug..fix/@{draft}/done.lock.",
          "MI0089",
        ),
      ).toBe("feature/hidden/bug-fix/draft/done");
    });

    it("returns the fallback when the branch name is empty or only separators", () => {
      expect(GitBranchFormatter.normalize("", "MI0089")).toBe("MI0089");
      expect(GitBranchFormatter.normalize("   ", "MI0089")).toBe("MI0089");
      expect(GitBranchFormatter.normalize("---", "MI0089")).toBe("MI0089");
      expect(GitBranchFormatter.normalize("@", "MI0089")).toBe("MI0089");
    });

    it("returns the fallback as provided", () => {
      expect(GitBranchFormatter.normalize(":::", "MI0089 bad:name")).toBe(
        "MI0089 bad:name",
      );
    });
  });
});
