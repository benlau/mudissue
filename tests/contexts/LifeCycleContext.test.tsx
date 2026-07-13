/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { act, render } from "@testing-library/react";
import {
  resetLifeCycleStore,
  useLifeCycleStore,
} from "../../src/store/LifeCycleStore.ts";
import { useLifeCycle } from "../../src/views/hooks/useLifeCycle.ts";

function ChildWithLifeCycleHook({ id }: { id: string }) {
  useLifeCycle(id);
  return null;
}

describe("LifeCycleStore", () => {
  beforeEach(() => {
    resetLifeCycleStore();
  });

  test("waitUntilMounted resolves after hook mounts id", async () => {
    await act(async () => {
      render(<ChildWithLifeCycleHook id="x" />);
    });

    await expect(
      useLifeCycleStore.getState().waitUntilMounted("x"),
    ).resolves.toBeUndefined();
  });

  test("waitUntilMounted resolves immediately when id is already mounted", async () => {
    useLifeCycleStore.getState().mount("already-mounted");
    await expect(
      useLifeCycleStore.getState().waitUntilMounted("already-mounted"),
    ).resolves.toBeUndefined();
  });

  test("waitUnitUnmounted resolves immediately when id is not mounted", async () => {
    await expect(
      useLifeCycleStore.getState().waitUnitUnmounted("never-mounted"),
    ).resolves.toBeUndefined();
  });

  test("waitUnitUnmounted resolves after hook unmounts id", async () => {
    const { unmount } = await act(async () =>
      render(<ChildWithLifeCycleHook id="y" />),
    );
    await useLifeCycleStore.getState().waitUntilMounted("y");

    const waitPromise = useLifeCycleStore.getState().waitUnitUnmounted("y");
    await act(async () => {
      unmount();
    });

    await expect(
      waitPromise,
    ).resolves.toBeUndefined();
  });

  test("waitUntilMounted with timeout rejects when id never mounts", async () => {
    await expect(
      useLifeCycleStore.getState().waitUntilMounted("never", 10),
    ).rejects.toThrow('waitUntilMounted("never") timed out');
  });

  test("waitUntilMounted with negative timeout waits until mount", async () => {
    const waitPromise = useLifeCycleStore.getState().waitUntilMounted("z", -1);
    useLifeCycleStore.getState().mount("z");
    await expect(waitPromise).resolves.toBeUndefined();
  });

  test("waitUnitUnmounted with timeout rejects when mounted id never unmounts", async () => {
    useLifeCycleStore.getState().mount("still-mounted");
    await expect(
      useLifeCycleStore.getState().waitUnitUnmounted("still-mounted", 10),
    ).rejects.toThrow('waitUnitUnmounted("still-mounted") timed out');
  });
});
