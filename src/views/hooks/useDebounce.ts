import { useCallback, useEffect, useRef, useState } from "react";

type DebounceStatus = "idle" | "pending" | "running";

export interface UseDebounce<T extends unknown[]> {
  status: DebounceStatus;
  run: (...args: T) => void;
  apply: (...args: T) => Promise<void>;
  cancel: () => void;
}

const IDLE = Symbol("IDLE");

export function useDebounce<T extends unknown[]>(
  delay: number,
  cb: (...args: T) => Promise<void> | void,
): UseDebounce<T> {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const [status, setStatus] = useState<DebounceStatus>("idle");
  const isRunningRef = useRef(false);
  const runArgsRef = useRef<T | typeof IDLE>(IDLE);
  const applyResolversRef = useRef<Array<() => void>>([]);

  const resolveApplyWaiters = useCallback(() => {
    const resolvers = applyResolversRef.current;
    applyResolversRef.current = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }, []);

  const runIfNeeded = useCallback(() => {
    if (isRunningRef.current) {
      return;
    }

    const args = runArgsRef.current;
    if (args === IDLE) {
      resolveApplyWaiters();
      return;
    }

    runArgsRef.current = IDLE;
    isRunningRef.current = true;
    setStatus("running");

    Promise.resolve(cbRef.current(...args))
      .catch(() => {})
      .finally(() => {
        isRunningRef.current = false;
        setStatus("idle");
        resolveApplyWaiters();

        globalThis.setTimeout(() => {
          runIfNeeded();
        });
      });
  }, [resolveApplyWaiters]);

  const scheduleRun = useCallback<(...args: T) => void>(
    (...args: T) => {
      runArgsRef.current = args;

      if (timerRef.current != null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setStatus((s) => (s !== "running" ? "pending" : s));
      timerRef.current = globalThis.setTimeout(() => {
        timerRef.current = null;
        runIfNeeded();
      }, delay);
    },
    [delay, runIfNeeded],
  );

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      globalThis.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    runArgsRef.current = IDLE;
    applyResolversRef.current = [];
    setStatus((s) => (s === "pending" ? "idle" : s));
  }, []);

  const apply = useCallback(
    (...args: T): Promise<void> => {
      if (timerRef.current != null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (args.length > 0) {
        runArgsRef.current = args;
      }

      if (runArgsRef.current === IDLE) {
        setStatus((s) => (s === "pending" ? "idle" : s));
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        applyResolversRef.current.push(resolve);
        runIfNeeded();
      });
    },
    [runIfNeeded],
  );

  return { status, run: scheduleRun, apply, cancel };
}
