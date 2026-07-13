import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ExtractContentIntoNewIssueHelper } from "../../../src/helpers/ExtractContentIntoNewIssueHelper.ts";
import {
  PaletteCommandRegistry,
  PaletteCommandRegistryScope,
} from "../../../src/views/PaletteCommands/PaletteCommandRegistry.ts";
import { ExtractContentIntoNewIssuePaletteCommand } from "../../../src/views/PaletteCommands/ExtractContentIntoNewIssuePaletteCommand.ts";

describe("ExtractContentIntoNewIssuePaletteCommand", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("is registered for IssueViewer only", () => {
    const issueViewerCommands = PaletteCommandRegistry.getPaletteCommands(
      PaletteCommandRegistryScope.IssueViewer,
    );
    const issueTableCommands = PaletteCommandRegistry.getPaletteCommands(
      PaletteCommandRegistryScope.IssueTable,
    );

    expect(
      issueViewerCommands.some(
        (command) => command.key === "extractContentIntoNewIssue",
      ),
    ).toBe(true);
    expect(
      issueTableCommands.some(
        (command) => command.key === "extractContentIntoNewIssue",
      ),
    ).toBe(false);
  });

  it("delegates to ExtractContentIntoNewIssueHelper", async () => {
    const extractMock = jest
      .spyOn(ExtractContentIntoNewIssueHelper.prototype, "extract")
      .mockResolvedValue(undefined);

    await new ExtractContentIntoNewIssuePaletteCommand().callback();

    expect(extractMock).toHaveBeenCalled();
  });
});
