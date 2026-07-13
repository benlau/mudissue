import {
  DEFAULT_ISSUE_BRANCH_NAME_TEMPLATE,
  DEFAULT_ISSUE_FILE_PATTERN,
  DEFAULT_WORKTREE_PATH,
  TrackerRepoConfigAccessor,
  type TrackerRepoConfig,
} from "../../src/types/Tracker.ts";
import type { GlobalConfig } from "../../src/types/GlobalConfig.ts";
import { DEFAULT_PRIORITY_TABLE } from "../../src/types/priority.ts";
import { DEFAULT_STATUS_LIST, DEFAULT_RESOLVED_STATUS_LIST } from "../../src/types/status.ts";
import { DEFAULT_LINK_TYPES } from "../../src/types/linkage.ts";

describe("TrackerRepoConfigAccessor", () => {
  const emptyRepo: TrackerRepoConfig = {};
  const emptyGlobal: GlobalConfig = {};

  describe("getEffectiveEditorPreference", () => {
    it("prefers repo editor over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { editor: "/project/code" },
        { default_editor: "/global/nano" },
      );
      expect(accessor.getEffectiveEditorPreference()).toBe("/project/code");
    });

    it("falls back to global default editor", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {},
        { default_editor: "/global/nano" },
      );
      expect(accessor.getEffectiveEditorPreference()).toBe("/global/nano");
    });

    it("returns null when neither repo nor global editor is set", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveEditorPreference()).toBeNull();
    });
  });

  describe("getEffectiveIssueFilePattern", () => {
    it("prefers repo pattern over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { issue_file_pattern: "short" },
        { default_issue_file_pattern: "long" },
      );
      expect(accessor.getEffectiveIssueFilePattern()).toBe("short");
    });

    it("defaults to long when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveIssueFilePattern()).toBe(
        DEFAULT_ISSUE_FILE_PATTERN,
      );
    });
  });

  describe("getEffectiveIssueFile", () => {
    it("prefers repo issue file over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { issue_file: "README.md" },
        { default_issue_file: "issue.md" },
      );
      expect(accessor.getEffectiveIssueFile()).toBe("README.md");
    });

    it("defaults to issue.md when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveIssueFile()).toBe("issue.md");
    });
  });

  describe("getEffectiveWorktreePath", () => {
    it("prefers repo worktree path over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { worktree_path: "wt/" },
        { default_worktree_path: "global-wt/" },
      );
      expect(accessor.getEffectiveWorktreePath()).toBe("wt/");
    });

    it("uses built-in default when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveWorktreePath()).toBe(DEFAULT_WORKTREE_PATH);
    });
  });

  describe("getEffectiveIssueBranchNameTemplate", () => {
    it("prefers repo template over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { issue_branch_name_template: "feature/<%= issue_id %>" },
        { default_issue_branch_name_template: "global/<%= issue_id %>" },
      );
      expect(accessor.getEffectiveIssueBranchNameTemplate()).toBe(
        "feature/<%= issue_id %>",
      );
    });

    it("uses built-in default when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveIssueBranchNameTemplate()).toBe(
        DEFAULT_ISSUE_BRANCH_NAME_TEMPLATE,
      );
    });
  });

  describe("getEffectivePriorityTable", () => {
    it("prefers repo priority list over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { priority_list: ["custom", "low"] },
        { default_priority_list: ["global", "low"] },
      );
      expect(accessor.getEffectivePriorityTable()).toEqual({
        initialPriority: "custom",
        priorities: ["custom", "low"],
      });
    });

    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectivePriorityTable()).toEqual(
        DEFAULT_PRIORITY_TABLE,
      );
    });

    it("uses global default_priority_list when repo priority_list is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, {
        default_priority_list: ["custom", "queued"],
      });
      expect(accessor.getEffectivePriorityTable()).toEqual({
        initialPriority: "custom",
        priorities: ["custom", "queued"],
      });
    });
  });

  describe("getDefaultPriority", () => {
    it("returns the marked default priority", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { priority_list: "urgent, high, *medium, low" },
        emptyGlobal,
      );
      expect(accessor.getDefaultPriority()).toBe("medium");
    });

    it("returns the built-in initial priority when no marker is present", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getDefaultPriority()).toBe("medium");
    });
  });

  describe("getEffectiveStatusList", () => {
    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveStatusList()).toEqual(DEFAULT_STATUS_LIST);
    });

    it("replaces the full list when repo status is set", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { status_list: "pending, open, closed" },
        emptyGlobal,
      );
      expect(accessor.getEffectiveStatusList()).toEqual([
        "pending",
        "open",
        "closed",
      ]);
    });

    it("prefers repo status_list over global default_status_list", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { status_list: ["open", "pending"] },
        { default_status_list: "custom, queued" },
      );
      expect(accessor.getEffectiveStatusList()).toEqual(["open", "pending"]);
    });

    it("uses global default_status_list when repo status_list is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, {
        default_status_list: ["custom", "queued"],
      });
      expect(accessor.getEffectiveStatusList()).toEqual(["custom", "queued"]);
    });
  });

  describe("getDefaultStatus", () => {
    it("returns the first effective status", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { status_list: "pending, open, closed" },
        emptyGlobal,
      );
      expect(accessor.getDefaultStatus()).toBe("pending");
    });
  });

  describe("getEffectiveResolvedStatusList", () => {
    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveResolvedStatusList()).toEqual(
        DEFAULT_RESOLVED_STATUS_LIST,
      );
    });

    it("prefers repo resolved_status_list over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { resolved_status_list: ["done", "wontfix"] },
        { default_resolved_status_list: ["closed"] },
      );
      expect(accessor.getEffectiveResolvedStatusList()).toEqual([
        "done",
        "wontfix",
      ]);
    });

    it("uses global default_resolved_status_list when repo override is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, {
        default_resolved_status_list: ["done", "wontfix"],
      });
      expect(accessor.getEffectiveResolvedStatusList()).toEqual([
        "done",
        "wontfix",
      ]);
    });
  });

  describe("isResolved", () => {
    it("returns true for built-in resolved statuses", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.isResolved("closed")).toBe(true);
      expect(accessor.isResolved("canceled")).toBe(true);
      expect(accessor.isResolved("duplicated")).toBe(true);
    });

    it("returns false for non-resolved statuses", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.isResolved("open")).toBe(false);
      expect(accessor.isResolved("in_progress")).toBe(false);
    });

    it("uses overridden resolved_status_list", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { resolved_status_list: "done, wontfix" },
        emptyGlobal,
      );
      expect(accessor.isResolved("done")).toBe(true);
      expect(accessor.isResolved("closed")).toBe(false);
    });
  });

  describe("getWorktreeGitFfOnlyEnabled", () => {
    it("prefers repo setting over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { worktree_git_ff_only_enabled: false },
        { worktree_git_ff_only_enabled: true },
      );
      expect(accessor.getWorktreeGitFfOnlyEnabled()).toBe(false);
    });

    it("defaults to false when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getWorktreeGitFfOnlyEnabled()).toBe(false);
    });
  });

  describe("getEffectiveIssuePath", () => {
    it("returns issue_path when set", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { issue_path: "docs/issues" },
        emptyGlobal,
      );
      expect(accessor.getEffectiveIssuePath()).toBe("docs/issues");
    });

    it("returns default issues when issue_path is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveIssuePath()).toBe("issues");
    });
  });

  describe("getEffectiveLinkTypes", () => {
    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveLinkTypes()).toEqual(DEFAULT_LINK_TYPES);
    });

    it("prefers repo link_types over global default_link_types", () => {
      const accessor = new TrackerRepoConfigAccessor(
        { link_types: ["depends_on/depended_on_by"] },
        { default_link_types: ["related/related"] },
      );
      expect(accessor.getEffectiveLinkTypes()).toEqual([
        { forward: "depends_on", reverse: "depended_on_by" },
      ]);
    });

    it("uses global default_link_types when repo link_types is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, {
        default_link_types: ["related/related"],
      });
      expect(accessor.getEffectiveLinkTypes()).toEqual([
        { forward: "related", reverse: "related" },
      ]);
    });
  });

  describe("getEffectiveBlockedStatusRule", () => {
    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveBlockedStatusRule()).toEqual({
        enabled: true,
        blocked_status: "blocked",
        unblocked_status: "open",
        blocking_link: "blocking",
        blocked_by_link: "blocked_by",
      });
    });

    it("merges a partial repo override onto defaults", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {
          system_blocked_status_rule: {
            enabled: true,
            blocked_status: "blockedA",
          },
        },
        emptyGlobal,
      );
      expect(accessor.getEffectiveBlockedStatusRule()).toEqual({
        enabled: true,
        blocked_status: "blockedA",
        unblocked_status: "open",
        blocking_link: "blocking",
        blocked_by_link: "blocked_by",
      });
    });

    it("prefers repo fields over global, leaving unset fields from lower layers", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {
          system_blocked_status_rule: {
            blocked_status: "waiting",
          },
        },
        {
          default_system_blocked_post_hook: {
            enabled: false,
            unblocked_status: "ready",
          },
        },
      );
      expect(accessor.getEffectiveBlockedStatusRule()).toEqual({
        enabled: false,
        blocked_status: "waiting",
        unblocked_status: "ready",
        blocking_link: "blocking",
        blocked_by_link: "blocked_by",
      });
    });

    it("uses global default_system_blocked_post_hook when repo override is unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, {
        default_system_blocked_post_hook: {
          enabled: true,
          blocked_status: "blocked",
          unblocked_status: "open",
          blocking_link: "blocking",
          blocked_by_link: "blocked_by",
        },
      });
      expect(accessor.getEffectiveBlockedStatusRule()).toEqual({
        enabled: true,
        blocked_status: "blocked",
        unblocked_status: "open",
        blocking_link: "blocking",
        blocked_by_link: "blocked_by",
      });
    });
  });

  describe("getEffectiveDuplicatedStatusRule", () => {
    it("returns built-in defaults when unset", () => {
      const accessor = new TrackerRepoConfigAccessor(emptyRepo, emptyGlobal);
      expect(accessor.getEffectiveDuplicatedStatusRule()).toEqual({
        enabled: true,
        duplicated_status: "duplicated",
        duplicated_link: "duplicated",
      });
    });

    it("merges a partial repo override onto defaults", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {
          system_duplicated_status_rule: {
            duplicated_status: "dup",
          },
        },
        emptyGlobal,
      );
      expect(accessor.getEffectiveDuplicatedStatusRule()).toEqual({
        enabled: true,
        duplicated_status: "dup",
        duplicated_link: "duplicated",
      });
    });

    it("prefers repo system_duplicated_status_rule over global default", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {
          system_duplicated_status_rule: {
            enabled: true,
            duplicated_status: "dup",
            duplicated_link: "duplicated",
          },
        },
        {
          default_system_duplicated_post_hook: {
            enabled: false,
            duplicated_status: "duplicated",
            duplicated_link: "duplicated",
          },
        },
      );
      expect(accessor.getEffectiveDuplicatedStatusRule()).toEqual({
        enabled: true,
        duplicated_status: "dup",
        duplicated_link: "duplicated",
      });
    });
  });

  describe("repo-only getters", () => {
    it("returns repo-only config fields", () => {
      const accessor = new TrackerRepoConfigAccessor(
        {
          issue_prefix: "MI",
          issue_path: "docs/issues",
          projects: ["a", "b"],
        },
        emptyGlobal,
      );
      expect(accessor.getIssuePrefix()).toBe("MI");
      expect(accessor.getIssuePath()).toBe("docs/issues");
      expect(accessor.getProjects()).toEqual(["a", "b"]);
    });
  });
});
