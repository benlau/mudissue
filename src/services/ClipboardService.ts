import clipboard from "clipboardy";

/**
 * Wraps system clipboard I/O for tests and to keep third-party imports out of views.
 */
export class ClipboardService {
  private static instance: ClipboardService;

  public static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  public static setInstance(instance: ClipboardService): void {
    ClipboardService.instance = instance;
  }

  async writeText(text: string): Promise<void> {
    await clipboard.write(text);
  }
}
