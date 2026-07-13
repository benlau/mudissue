import { jest } from "@jest/globals";
import { useCreateIssueFromFileDialogStore } from "../../../src/store/CreateIssueFromFileDialogStore.ts";
import { CreateIssueFromFilePaletteCommand } from "../../../src/views/PaletteCommands/CreateIssueFromFilePaletteCommand.ts";

describe("CreateIssueFromFilePaletteCommand", () => {
  beforeEach(() => {
    useCreateIssueFromFileDialogStore.setState({
      isDialogOpen: false,
      pendingResolve: null,
    });
  });

  afterEach(() => {
    useCreateIssueFromFileDialogStore.setState({
      isDialogOpen: false,
      pendingResolve: null,
    });
  });

  it("opens the create issue from file dialog", async () => {
    const openMock = jest.fn().mockResolvedValue({ type: "cancelled" });
    useCreateIssueFromFileDialogStore.setState({ open: openMock });

    await new CreateIssueFromFilePaletteCommand().callback();

    expect(openMock).toHaveBeenCalled();
  });
});
