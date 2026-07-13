import { jest } from "@jest/globals";
import { CommentAuthorHelper } from "../../src/helpers/CommentAuthorHelper.ts";
import { MUDISSUE_STATE_URL } from "../../src/constants.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { MudissueStateKey } from "../../src/types/registry.ts";

describe("CommentAuthorHelper.queryCommentAuthor", () => {
  let registryService: RegistryService;
  let shellService: ShellService;
  let originalRegistry: RegistryService | null;
  let originalShell: ShellService | null;

  beforeEach(() => {
    originalRegistry = RegistryService.instance;
    originalShell = ShellService.instance as ShellService | null;
    registryService = {
      get: jest.fn(),
    } as unknown as RegistryService;
    shellService = {
      which: jest.fn(),
      runAndCapture: jest.fn(() => ({ status: 1, stdout: "" })),
    } as unknown as ShellService;
    RegistryService.setInstance(registryService);
    ShellService.setInstance(shellService);
  });

  afterEach(() => {
    if (originalRegistry != null) {
      RegistryService.setInstance(originalRegistry);
    } else {
      RegistryService.instance = null;
    }
    ShellService.setInstance(originalShell);
  });

  it("returns explicit --author when provided", async () => {
    const result = await CommentAuthorHelper.queryCommentAuthor("  Ben Lau  ");
    expect(result).toBe("Ben Lau");
    expect(registryService.get).not.toHaveBeenCalled();
  });

  it("returns system registry USERNAME when flag omitted", async () => {
    registryService.get = jest.fn(async () => ({
      url: MUDISSUE_STATE_URL,
      value: "Registry User",
    })) as typeof registryService.get;

    const result = await CommentAuthorHelper.queryCommentAuthor();

    expect(result).toBe("Registry User");
    expect(registryService.get).toHaveBeenCalledWith(
      MUDISSUE_STATE_URL,
      "system",
      MudissueStateKey.Username,
    );
  });

  it("falls back to git config user.name when registry is empty", async () => {
    registryService.get = jest.fn(async () => null) as typeof registryService.get;
    shellService.which = jest.fn(async () => "/usr/bin/git") as typeof shellService.which;
    shellService.runAndCapture = jest.fn(() => ({
      status: 0,
      stdout: "Git User\n",
    })) as typeof shellService.runAndCapture;

    const result = await CommentAuthorHelper.queryCommentAuthor();

    expect(result).toBe("Git User");
    expect(shellService.runAndCapture).toHaveBeenCalledWith("git", [
      "config",
      "--get",
      "user.name",
    ]);
  });

  it("uses OS username when git is not on PATH", async () => {
    registryService.get = jest.fn(async () => null) as typeof registryService.get;
    shellService.which = jest.fn(async () => null) as typeof shellService.which;

    const result = await CommentAuthorHelper.queryCommentAuthor();

    expect(result.length).toBeGreaterThan(0);
    expect(shellService.runAndCapture).not.toHaveBeenCalled();
  });

});
