import { jest } from "@jest/globals";
import {
  EXAMPLE_GLOBAL_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILENAME,
} from "../../../src/constants.ts";
import { GlobalConfigStorage } from "../../../src/utils/storage/GlobalConfigStorage.ts";
import { FileService } from "../../../src/services/FileService.ts";

describe("GlobalConfigStorage", () => {
  let mockFileService: jest.Mocked<FileService>;
  let savedFileService: FileService;

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    mockFileService = {
      exists: jest.fn(),
      readFile: jest.fn(),
      mkdir: jest.fn(),
      writeFile: jest.fn(),
    } as unknown as jest.Mocked<FileService>;
    FileService.setInstance(mockFileService as unknown as FileService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
  });

  describe("getPath", () => {
    it("returns path under homedir containing global config dir and filename", () => {
      const storage = new GlobalConfigStorage();
      const p = storage.getPath();
      expect(p).toContain(GLOBAL_CONFIG_DIR);
      expect(p).toContain(GLOBAL_CONFIG_FILENAME);
    });
  });

  describe("read", () => {
    it("returns empty object when file does not exist", async () => {
      mockFileService.exists.mockResolvedValue(false);
      const storage = new GlobalConfigStorage();
      const config = await storage.read();
      expect(config).toEqual({});
      expect(mockFileService.readFile).not.toHaveBeenCalled();
    });

    it("throws when default_status_list is invalid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "default_status_list: open, open\n" as unknown as Buffer,
      );
      const storage = new GlobalConfigStorage();
      await expect(storage.read()).rejects.toThrow(/Invalid config/);
      await expect(storage.read()).rejects.toThrow(EXAMPLE_GLOBAL_CONFIG);
    });

    it("throws when default_resolved_status_list is invalid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "default_resolved_status_list: []\n" as unknown as Buffer,
      );
      const storage = new GlobalConfigStorage();
      await expect(storage.read()).rejects.toThrow(/Invalid config/);
      await expect(storage.read()).rejects.toThrow(EXAMPLE_GLOBAL_CONFIG);
    });

    it("throws when default_issue_file_pattern is invalid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "default_issue_file_pattern: nope\n" as unknown as Buffer,
      );
      const storage = new GlobalConfigStorage();
      await expect(storage.read()).rejects.toThrow(/Invalid config/);
      await expect(storage.read()).rejects.toThrow(EXAMPLE_GLOBAL_CONFIG);
    });

    it("throws when YAML is invalid", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "default_editor: [\n" as unknown as Buffer,
      );
      const storage = new GlobalConfigStorage();
      await expect(storage.read()).rejects.toThrow(/Invalid YAML/);
    });

    it("returns parsed YAML config when file exists", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "default_editor: vim\ndefault_issue_branch_name_template: pr/<%= issue_folder_name %>\n" as unknown as Buffer,
      );
      const storage = new GlobalConfigStorage();
      const config = await storage.read();
      expect(config).toEqual({
        default_editor: "vim",
        default_issue_branch_name_template: "pr/<%= issue_folder_name %>",
      });
    });
  });

  describe("write", () => {
    it("creates parent dir and writes YAML when dir missing", async () => {
      mockFileService.exists.mockResolvedValue(false);
      mockFileService.mkdir.mockResolvedValue(undefined);
      mockFileService.writeFile.mockResolvedValue(undefined);
      const storage = new GlobalConfigStorage();
      await storage.write({ default_editor: "nvim" });
      expect(mockFileService.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(GLOBAL_CONFIG_DIR),
        { recursive: true },
      );
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(GLOBAL_CONFIG_FILENAME),
        expect.stringContaining("default_editor"),
      );
    });

    it("writes config without calling mkdir when dir exists", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.writeFile.mockResolvedValue(undefined);
      const storage = new GlobalConfigStorage();
      await storage.write({});
      expect(mockFileService.mkdir).not.toHaveBeenCalled();
      expect(mockFileService.writeFile).toHaveBeenCalled();
    });
  });
});
