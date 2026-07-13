import * as os from "os";
import * as path from "path";
import YAML from "js-yaml";
import {
  EXAMPLE_GLOBAL_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILENAME,
} from "../../constants.ts";
import { ZodErrorFormatter } from "../../foundation/formatter/ZodErrorFormatter.ts";
import { FileService } from "../../services/FileService.ts";
import {
  GlobalConfigSchema,
  type GlobalConfig,
} from "../../types/GlobalConfig.ts";

export class GlobalConfigStorage {
  private readonly fileService: FileService;

  constructor() {
    this.fileService = FileService.getInstance();
  }

  /** Absolute path of the global config file (~/.mudissue/global.conf). */
  getPath(): string {
    return path.join(os.homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILENAME);
  }

  /** Reads and parses global config. Returns merged config or empty object if file missing. */
  async read(): Promise<GlobalConfig> {
    const configPath = this.getPath();
    const exists = await this.fileService.exists(configPath);
    if (!exists) {
      return {};
    }
    const content = (await this.fileService.readFile(
      configPath,
      "utf-8",
    )) as string;
    let raw: unknown;
    try {
      raw = YAML.load(content);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid YAML in ${configPath}: ${reason}`);
    }
    // Empty or comment-only YAML documents parse as null.
    if (raw == null) {
      raw = {};
    }
    const parsed = GlobalConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid config in ${configPath}: ${ZodErrorFormatter.format(parsed.error)}\n\nExample:\n${EXAMPLE_GLOBAL_CONFIG}`,
      );
    }
    return parsed.data;
  }

  /** Writes config to the global file. Ensures parent directory exists. */
  async write(config: GlobalConfig): Promise<void> {
    const configPath = this.getPath();
    const dir = path.dirname(configPath);
    const dirExists = await this.fileService.exists(dir);
    if (!dirExists) {
      await this.fileService.mkdir(dir, { recursive: true });
    }
    const content = YAML.dump(config, { lineWidth: -1 });
    await this.fileService.writeFile(configPath, content);
  }
}
