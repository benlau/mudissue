import * as os from "os";
import { MUDISSUE_STATE_URL } from "../constants.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { ShellService } from "../services/ShellService.ts";
import { MudissueStateKey } from "../types/registry.ts";

function trimNonEmpty(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CommentAuthorHelper {
  static async queryCommentAuthor(explicitAuthor?: string): Promise<string> {
    const fromFlag = trimNonEmpty(explicitAuthor);
    if (fromFlag != null) {
      return fromFlag;
    }

    const registryService = RegistryService.getInstance();
    const shellService = ShellService.getInstance();

    const registryRow = await registryService.get(
      MUDISSUE_STATE_URL,
      "system",
      MudissueStateKey.Username,
    );
    const fromRegistry = trimNonEmpty(registryRow?.value);
    if (fromRegistry != null) {
      return fromRegistry;
    }

    const gitPath = await shellService.which("git");
    if (gitPath != null) {
      const { status, stdout } = shellService.runAndCapture("git", [
        "config",
        "--get",
        "user.name",
      ]);
      const fromGit = status === 0 ? trimNonEmpty(stdout) : undefined;
      if (fromGit != null) {
        return fromGit;
      }
    }

    const fromOs = trimNonEmpty(os.userInfo().username);
    if (fromOs != null) {
      return fromOs;
    }

    return "";
  }
}
