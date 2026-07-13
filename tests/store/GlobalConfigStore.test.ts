import { jest } from "@jest/globals";
import { FileService } from "../../src/services/FileService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";

describe("GlobalConfigStore", () => {
  let mockFileService: jest.Mocked<Pick<FileService, "exists" | "readFile">>;

  beforeEach(() => {
    resetGlobalConfigStore();
    FileService.setInstance(null as any);
    mockFileService = {
      exists: jest.fn(),
      readFile: jest.fn(),
    } as unknown as jest.Mocked<Pick<FileService, "exists" | "readFile">>;
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  it("sets default empty config when global config read fails with ENOENT", async () => {
    const enoent = Object.assign(new Error("ENOENT"), {
      code: "ENOENT" as const,
    });
    mockFileService.exists.mockResolvedValue(true);
    mockFileService.readFile.mockRejectedValue(enoent);

    const config = await useGlobalConfigStore.getState().ensureGlobalConfig();

    expect(config).toEqual({});
    expect(useGlobalConfigStore.getState().globalConfig).toEqual({});
  });

  it("loads parsed global config when the file exists and is valid YAML", async () => {
    mockFileService.exists.mockResolvedValue(true);
    mockFileService.readFile.mockResolvedValue(
      "default_editor: vim\ndefault_issue_branch_name_template: pr/<%= issue_folder_name %>\n",
    );

    const config = await useGlobalConfigStore.getState().ensureGlobalConfig();

    expect(config).toEqual({
      default_editor: "vim",
      default_issue_branch_name_template: "pr/<%= issue_folder_name %>",
    });
    expect(useGlobalConfigStore.getState().globalConfig).toEqual({
      default_editor: "vim",
      default_issue_branch_name_template: "pr/<%= issue_folder_name %>",
    });
  });

  it("rethrows non-ENOENT errors from read", async () => {
    const other = new Error("EACCES");
    Object.assign(other, { code: "EACCES" });
    mockFileService.exists.mockResolvedValue(true);
    mockFileService.readFile.mockRejectedValue(other);

    await expect(
      useGlobalConfigStore.getState().ensureGlobalConfig(),
    ).rejects.toBe(other);

    expect(useGlobalConfigStore.getState().globalConfig).toBeNull();
  });

  it("reloadGlobalConfig replaces cached config with fresh disk content", async () => {
    mockFileService.exists.mockResolvedValue(true);
    mockFileService.readFile.mockResolvedValue("default_editor: vim\n");

    await useGlobalConfigStore.getState().ensureGlobalConfig();

    mockFileService.readFile.mockResolvedValue(
      "default_editor: emacs\ndefault_status_list: open, closed\n",
    );

    const reloaded = await useGlobalConfigStore.getState().reloadGlobalConfig();

    expect(reloaded).toEqual({
      default_editor: "emacs",
      default_status_list: ["open", "closed"],
    });
    expect(useGlobalConfigStore.getState().globalConfig).toEqual({
      default_editor: "emacs",
      default_status_list: ["open", "closed"],
    });
  });
});
