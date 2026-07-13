import { Box, Text, useInput } from "ink";
import { AppContextProvider } from "./contexts/AppContext.tsx";
import { usePopupStore } from "./store/PopupStore.ts";
import { AlertDialog } from "./views/components/AlertDialog.tsx";
import { ConfirmationDialog } from "./views/components/ConfirmationDialog.tsx";
import { CreateIssueDialog } from "./views/components/CreateIssueDialog.tsx";
import { CreateIssueFromFileDialog } from "./views/components/CreateIssueFromFileDialog.tsx";
import { TextEditDialog } from "./views/components/TextEditDialog.tsx";
import { IssueTable } from "./views/components/IssueTable.tsx";
import { IssueViewer } from "./views/components/IssueViewer.tsx";
import { PickItemDialog } from "./views/components/PickItemDialog.tsx";
import { Toast } from "./views/components/Toast.tsx";
import { PaletteCommandDialog } from "./views/components/PaletteCommandDialog.tsx";
import { IssueSearchingDialog } from "./views/components/IssueSearchingDialog.tsx";
import { useLayoutEffect } from "react";
import { AnsiEscapeCode } from "./types/ansi.ts";
import { useAppStore } from "./store/AppStore.ts";
import { useQuit } from "./views/hooks/useQuit.ts";

function AppContent() {
  const mainIssueLists = useAppStore((s) => s.mainIssueLists);
  const currentPage = useAppStore((s) => s.getCurrentPage());

  useLayoutEffect(() => {
    // Enter alternate screen buffer before Ink paints the remounted tree.
    process.stdout.write(AnsiEscapeCode.ENTER_ALTERNATE_SCREEN);

    return () => {
      // Exit alternate screen buffer on unmount
      process.stdout.write(AnsiEscapeCode.EXIT_ALTERNATE_SCREEN);
    };
  }, []);

  if (mainIssueLists === null) {
    return (
      <Box>
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (currentPage.name === "ISSUE_VIEWER") {
    return <IssueViewer issue={currentPage.args.issue} />;
  }
  return <IssueTable />;
}

function QuitOnCtrlCHandler() {
  const hasPopup = usePopupStore((s) => s.hasPopup);
  const { quitIfConfirmed } = useQuit();

  useInput(
    (input, key) => {
      if (hasPopup) return;
      if (key.ctrl && input === "c") {
        void quitIfConfirmed();
      }
    },
  );

  return null;
}

export function App() {
  return (
    <AppContextProvider>
      <QuitOnCtrlCHandler />
      <AppContent />
      <PickItemDialog />
      <CreateIssueDialog />
      <CreateIssueFromFileDialog />
      <TextEditDialog />
      <PaletteCommandDialog />
      <IssueSearchingDialog />
      {/* Alert/confirmation must render after feature dialogs so Ink paints them on top. */}
      <AlertDialog />
      <ConfirmationDialog />
      <Toast />
    </AppContextProvider>
  );
}
