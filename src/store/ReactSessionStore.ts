import type { Instance } from "ink";
import { create } from "zustand";

export type ReactInstanceFactory = () => Instance;

export type ReactSessionRunOptions = {
  onResume?: () => void;
};

type SessionState = {
  inkInstance: Instance | null;
  quitRequested: boolean;
  /**
   * Handoff synchronization between `run()` and `suspend()` / `resume()`.
   *
   * `suspend()` unmounts Ink, which resolves `waitUntilExit()` in both
   * `suspend()` and the `run()` loop. Without this gate, `run()` would
   * re-render immediately while the external app (editor, shell, script)
   * still owns the terminal.
   *
   * Flow:
   * 1. `suspend()` sets `handoffGate` to a pending promise, then unmounts.
   * 2. `run()` sees the gate after `waitUntilExit()` and blocks on it.
   * 3. External work runs between `suspend()` returning and `resume()`.
   * 4. `resume()` calls `releaseHandoff`, the gate resolves, and `run()`
   *    re-renders.
   *
   * `null` means the Ink exit was a quit, not a handoff.
   */
  handoffGate: Promise<void> | null;
  /** Resolver for `handoffGate`; invoked by `resume()`. */
  releaseHandoff: (() => void) | null;
  onResumeCallback: (() => void) | null;
};

const sessionState: SessionState = {
  inkInstance: null,
  quitRequested: false,
  handoffGate: null,
  releaseHandoff: null,
  onResumeCallback: null,
};

export type ReactSessionStoreState = {
  run: (
    createInstance: ReactInstanceFactory,
    options?: ReactSessionRunOptions,
  ) => Promise<void>;
  suspend: () => Promise<void>;
  resume: () => void;
  requestQuit: () => void;
};

export const useReactSessionStore = create<ReactSessionStoreState>()(() => ({
  async run(createInstance, options) {
    sessionState.quitRequested = false;
    sessionState.onResumeCallback = options?.onResume ?? null;

    while (!sessionState.quitRequested) {
      sessionState.inkInstance = createInstance();
      await sessionState.inkInstance.waitUntilExit();

      if (sessionState.quitRequested) {
        break;
      }

      // Ink exited via handoff, not quit. Wait until the caller finishes
      // external work and calls `resume()` before starting a new render().
      if (sessionState.handoffGate != null) {
        await sessionState.handoffGate;
        sessionState.handoffGate = null;
        sessionState.releaseHandoff = null;
        sessionState.onResumeCallback?.();
        continue;
      }

      // Ink exited without a handoff gate and without quit — unexpected path.
      break;
    }
  },

  async suspend() {
    const inkInstance = sessionState.inkInstance;
    if (inkInstance == null) {
      throw new Error(
        "ReactSessionStore.suspend() called without an active session",
      );
    }

    // Create the gate before unmounting so `run()` can distinguish handoff
    // from quit once `waitUntilExit()` resolves in both places.
    sessionState.handoffGate = new Promise<void>((resolve) => {
      sessionState.releaseHandoff = resolve;
    });
    inkInstance.unmount();
    // Returns after Ink releases the terminal; caller runs external work next.
    await inkInstance.waitUntilExit();
  },

  /** Opens `handoffGate` so `run()` can re-render after external work ends. */
  resume() {
    sessionState.releaseHandoff?.();
  },

  requestQuit() {
    sessionState.quitRequested = true;
  },
}));

export function resetReactSessionStore(): void {
  sessionState.inkInstance = null;
  sessionState.quitRequested = false;
  sessionState.handoffGate = null;
  sessionState.releaseHandoff = null;
  sessionState.onResumeCallback = null;
}
