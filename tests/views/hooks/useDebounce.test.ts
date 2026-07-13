/**
 * @jest-environment jsdom
 */
import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "../../../src/views/hooks/useDebounce.ts";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("invokes the callback after the delay", () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useDebounce(300, cb));

    act(() => {
      result.current.run("a");
    });
    expect(cb).not.toHaveBeenCalled();
    expect(result.current.status).toBe("pending");

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(cb).toHaveBeenCalledWith("a");
  });

  it("resets the timer when run is called again before the delay elapses", () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useDebounce(300, cb));

    act(() => {
      result.current.run("first");
      jest.advanceTimersByTime(200);
      result.current.run("second");
      jest.advanceTimersByTime(200);
    });
    expect(cb).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("second");
  });

  it("cancels a pending invocation", () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useDebounce(300, cb));

    act(() => {
      result.current.run("a");
      result.current.cancel();
      jest.advanceTimersByTime(300);
    });
    expect(cb).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("runs the pending callback immediately when apply is called", async () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useDebounce(300, cb));

    await act(async () => {
      result.current.run("a");
      const pending = result.current.apply();
      await pending;
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("a");

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("runs apply with explicit args immediately", async () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useDebounce(300, cb));

    await act(async () => {
      result.current.run("queued");
      await result.current.apply("immediate");
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("immediate");
  });
});
