import { jest } from "@jest/globals";
import {
  resetIssueMetadataChangedPostHookStore,
  useIssueMetadataChangedPostHookStore,
} from "../../src/store/IssueMetadataChangedPostHookStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { SystemRuleKey } from "../../src/types/rules.ts";

const issue: IssueFolder = { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
 };

describe("IssueMetadataChangedPostHookStore", () => {
  beforeEach(() => {
    resetIssueMetadataChangedPostHookStore();
  });

  it("invokes registered hooks in registration order with old and new metadata", async () => {
    const calls: Array<{
      key: string;
      newMetadata: Record<string, unknown>;
      oldMetadata: Record<string, unknown>;
    }> = [];

    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, async (_i, neu, old) => {
        calls.push({
          key: SystemRuleKey.BlockedStatusRule,
          newMetadata: neu,
          oldMetadata: old,
        });
      });
    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(
        SystemRuleKey.DuplicatedStatusRule,
        async (_i, neu, old) => {
          calls.push({
            key: SystemRuleKey.DuplicatedStatusRule,
            newMetadata: neu,
            oldMetadata: old,
          });
        },
      );

    await useIssueMetadataChangedPostHookStore
      .getState()
      .notifyMetadataChanged(
        issue,
        { status: "closed" },
        { status: "open" },
      );

    expect(calls).toEqual([
      {
        key: SystemRuleKey.BlockedStatusRule,
        newMetadata: { status: "closed" },
        oldMetadata: { status: "open" },
      },
      {
        key: SystemRuleKey.DuplicatedStatusRule,
        newMetadata: { status: "closed" },
        oldMetadata: { status: "open" },
      },
    ]);
  });

  it("replaces an existing hook when registering the same SystemRuleKey again", async () => {
    const first = jest.fn();
    const second = jest.fn();

    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, first);
    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, second);

    await useIssueMetadataChangedPostHookStore
      .getState()
      .notifyMetadataChanged(issue, { status: "open" }, {});

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("skips nested notifyMetadataChanged while hooks are already running", async () => {
    const nested = jest.fn();
    let nestedNotifyRan = false;

    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, async () => {
        await useIssueMetadataChangedPostHookStore
          .getState()
          .notifyMetadataChanged(issue, { status: "blocked" }, {});
        nestedNotifyRan = true;
      });
    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.DuplicatedStatusRule, nested);

    await useIssueMetadataChangedPostHookStore
      .getState()
      .notifyMetadataChanged(issue, { status: "closed" }, { status: "open" });

    expect(nestedNotifyRan).toBe(true);
    expect(nested).toHaveBeenCalledTimes(1);
  });
});
