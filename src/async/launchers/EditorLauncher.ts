import { ShellService } from "../../services/ShellService.ts";

export type EditorLaunchInput = {
  filePath: string;
  isBlocked: boolean;
};

export type EditorLauncherProps = {
  shellService?: ShellService;
};

export class EditorLauncher {
  private readonly shellService: ShellService;

  constructor(props: EditorLauncherProps = {}) {
    this.shellService = props.shellService ?? ShellService.getInstance();
  }

  async launch(
    editor: string,
    input: EditorLaunchInput & { isBlocked: false },
  ): Promise<string>;
  async launch(
    editor: string,
    input: EditorLaunchInput & { isBlocked: true },
  ): Promise<void>;
  async launch(
    editor: string,
    { filePath, isBlocked }: EditorLaunchInput,
  ): Promise<string | void> {
    if (editor === null) {
      throw new Error("no external editor available");
    }
    if (isBlocked) {
      this.shellService.runAndWait(editor, [filePath]);
      return;
    }
    this.shellService.run(editor, [filePath]);
    return `${editor} ${filePath}`;
  }
}
