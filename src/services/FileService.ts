import * as fs from "fs";

/**
 * FileService provides an abstraction layer for file system operations.
 * This allows for easier testing and decoupling of file I/O from business logic.
 */
export class FileService {
  private static instance: FileService;

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  constructor() {}

  public static setInstance(instance: FileService): void {
    FileService.instance = instance;
  }

  async exists(path: string): Promise<boolean> {
    return fs.promises
      .access(path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  async isExecutable(path: string): Promise<boolean> {
    return fs.promises
      .access(path, fs.constants.X_OK)
      .then(() => true)
      .catch(() => false);
  }

  async readFile(
    path: string,
    encoding: string = "utf-8",
  ): Promise<string | Buffer> {
    return fs.promises.readFile(
      path,
      encoding as Parameters<typeof fs.promises.readFile>[1],
    );
  }

  /**
   * Read directory entries with their types.
   * @param path - The directory path to read
   * @returns Array of directory entries
   * @throws Error if the directory cannot be read
   */
  async readdir(path: string): Promise<fs.Dirent[]> {
    return fs.promises.readdir(path, { withFileTypes: true });
  }

  /**
   * Write content to a file.
   * @param path - The file path to write to
   * @param content - The content to write
   * @param encoding - Optional encoding (e.g., 'utf-8')
   * @throws Error if the file cannot be written
   */
  async writeFile(
    path: string,
    content: string | Buffer,
    encoding?: string,
  ): Promise<void> {
    if (encoding !== undefined && typeof content === "string") {
      return fs.promises.writeFile(
        path,
        content,
        encoding as Parameters<typeof fs.promises.writeFile>[2],
      );
    }
    return fs.promises.writeFile(path, content);
  }

  /**
   * Append content to a file.
   * @param path - The file path to append to
   * @param content - The content to append
   * @throws Error if the file cannot be written
   */
  async appendFile(path: string, content: string): Promise<void> {
    return fs.promises.appendFile(path, content);
  }

  /**
   * Create a directory.
   * @param path - The directory path to create
   * @param options - Options for mkdir (e.g., { recursive: true })
   * @throws Error if the directory cannot be created
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.promises.mkdir(path, options);
  }

  /**
   * Get file or directory statistics.
   * @param path - The file or directory path
   * @returns File statistics object
   * @throws Error if the path does not exist or cannot be accessed
   */
  async stat(path: string): Promise<fs.Stats> {
    return fs.promises.stat(path);
  }

  /**
   * Copy a file.
   * @param from - Source file path
   * @param to - Destination file path
   * @throws Error if the copy fails
   */
  async copyFile(from: string, to: string): Promise<void> {
    return fs.promises.copyFile(from, to);
  }

  /**
   * Rename or move a file or directory.
   * @param oldPath - The current path
   * @param newPath - The new path
   * @throws Error if the rename fails
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    return fs.promises.rename(oldPath, newPath);
  }

  /**
   * Remove a single file.
   * Does not support recursive or force options — callers must delete
   * known files individually, then rmdir empty directories, so unknown
   * contents are never removed by accident.
   */
  async rm(filePath: string): Promise<void> {
    return fs.promises.unlink(filePath);
  }

  async chmod(filePath: string, mode: number): Promise<void> {
    await fs.promises.chmod(filePath, mode);
  }

  async rmdir(dirPath: string): Promise<void> {
    return fs.promises.rmdir(dirPath);
  }

  /**
   * Watch a file for changes. Uses Node's fs.watch.
   * @param path - The file path to watch
   * @param callback - Called when the file changes (or on watch error)
   * @returns Unsubscribe function that stops watching (e.g. call in React cleanup)
   */
  watch(path: string, callback: () => void): () => void {
    const watcher = fs.watch(path, (_eventType, _filename) => {
      callback();
    });
    watcher.on("error", () => {
      watcher.close();
    });
    return () => {
      watcher.close();
    };
  }

  /**
   * Check if a file contains binary content (null bytes in first 512 bytes).
   * @param path - The file path
   * @returns true if file appears binary
   */
  async isBinaryFile(path: string): Promise<boolean> {
    const handle = await fs.promises.open(path, "r");
    try {
      const buffer = Buffer.alloc(512);
      const { bytesRead } = await handle.read(buffer, 0, 512, 0);
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      return false;
    } finally {
      await handle.close();
    }
  }
}
