import { jest } from "@jest/globals";
import { ShellService } from "../../../src/services/ShellService.ts";
import { EditorLauncher } from "../../../src/utils/launchers/EditorLauncher.ts";

describe("EditorLauncher", () => {
  let launcher: EditorLauncher;
  let mockShellService: jest.Mocked<Pick<ShellService, "run" | "runAndWait">>;

  beforeEach(() => {
    mockShellService = {
      run: jest.fn(),
      runAndWait: jest.fn().mockReturnValue({ status: 0 }),
    } as unknown as jest.Mocked<
      Pick<ShellService, "run" | "runAndWait">
    >;
    launcher = new EditorLauncher({
      shellService: mockShellService as unknown as ShellService,
    });
  });

  afterEach(() => {
    ShellService.setInstance(null);
  });

  describe("launch with isBlocked: false", () => {
    it("calls shellService.run with resolved editor and file path and returns command string", async () => {
      const command = await launcher.launch("my-editor", {
        filePath: "/path/to/file.md",
        isBlocked: false,
      });

      expect(mockShellService.run).toHaveBeenCalledWith("my-editor", [
        "/path/to/file.md",
      ]);
      expect(command).toBe("my-editor /path/to/file.md");
    });

    it("throws with message 'no external editor available' when editor is null", async () => {
      await expect(
        launcher.launch(null as unknown as string, {
          filePath: "/any/path",
          isBlocked: false,
        }),
      ).rejects.toThrow("no external editor available");
      expect(mockShellService.run).not.toHaveBeenCalled();
    });
  });

  describe("launch with isBlocked: true", () => {
    it("calls shellService.runAndWait with editor and file path", async () => {
      await launcher.launch("my-editor", {
        filePath: "/path/to/file.md",
        isBlocked: true,
      });

      expect(mockShellService.runAndWait).toHaveBeenCalledWith("my-editor", [
        "/path/to/file.md",
      ]);
    });
  });
});
