import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { EditorLauncher } from "../utils/launchers/EditorLauncher.ts";
import { useReactSessionStore } from "../store/ReactSessionStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../store/ToastStore.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../views/components/PickItemDialog.tsx";

type EditFileFn = (
  filePath: string,
  options?: { pickEditor?: boolean },
) => Promise<void>;

const EditFileContext = createContext<EditFileFn | null>(null);

export type AppContextProviderProps = {
  children: ReactNode;
};

export function AppContextProvider({
  children,
}: AppContextProviderProps) {
  const filter = useAppStore((s) => s.filter);

  useEffect(() => {
    void useAppStore.getState().refreshIssueLists();
  }, [filter]);

  const editFile = useCallback<EditFileFn>(
    async (filePath, options) => {
      const repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
      const trackerRepoStore = useCurrentTrackerRepoStore.getState();
      const pickEditor = options?.pickEditor === true;

      let editor: string | null = null;
      if (pickEditor) {
        const availableEditors = await trackerRepoStore.getAvailableEditors(
          repo.config,
        );
        if (availableEditors.length === 0) {
          void useToastStore
            .getState()
            .error("No editor found.", { position: "top-middle" });
          return;
        }

        const editorResponse = await usePickItemDialogStore
          .getState()
          .open(availableEditors, (e) => e, {
            title: "Select Editor",
            footerLabel: "Cancel<Esc>",
            minWidth: 52,
            maxWidth: 86,
          });
        if (
          editorResponse.type !== PickItemDialogResponseType.Accepted ||
          !editorResponse.acceptedValue
        ) {
          return;
        }
        editor = editorResponse.acceptedValue;
      } else {
        editor = await trackerRepoStore.getEditor(repo.config);
        if (!editor) {
          void useToastStore
            .getState()
            .error("No editor found.", { position: "top-middle" });
          return;
        }
      }

      await useReactSessionStore.getState().suspend();

      try {
        const message = `${editor} ${filePath}\n`;
        process.stdout.write(message);
        await new EditorLauncher().launch(editor, { filePath, isBlocked: true });
      } finally {
        useReactSessionStore.getState().resume();
      }
    },
    [],
  );

  return (
    <EditFileContext.Provider value={editFile}>
      {children}
    </EditFileContext.Provider>
  );
}

export function useEditFile(): EditFileFn {
  const editFile = useContext(EditFileContext);
  if (editFile == null) {
    throw new Error("useEditFile must be used within AppContextProvider");
  }
  return editFile;
}
