import { useCallback } from "react";
import { useApp } from "ink";
import { useReactSessionStore } from "../../store/ReactSessionStore.ts";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";

export function useQuit(): {
  requestQuit: () => Promise<boolean>;
  quitIfConfirmed: () => Promise<void>;
} {
  const { exit } = useApp();

  const requestQuit = useCallback(async (): Promise<boolean> => {
    const result = await useConfirmationDialogStore.getState().open({
      title: "Quit MudIssue?",
      message: "Press Ctrl+C or Enter to quit. Press any other key to cancel.",
      confirmLabel: "Quit",
      variant: "destructive",
      ctrlCToConfirm: true,
    });
    return result.type === "accepted";
  }, []);

  const quitIfConfirmed = useCallback(async (): Promise<void> => {
    if (await requestQuit()) {
      useReactSessionStore.getState().requestQuit();
      exit();
    }
  }, [exit, requestQuit]);

  return { requestQuit, quitIfConfirmed };
}
