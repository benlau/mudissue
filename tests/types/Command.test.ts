import { describe, it, expect } from "@jest/globals";
import { Command } from "../../src/commands/Command.ts";
import type { SuccessResponse, ErrorResponse } from "../../src/types/Response.ts";

class TestCommand extends Command {
  name = "test";
  async command(..._args: unknown[]): Promise<SuccessResponse<unknown> | ErrorResponse> {
    return { status: "ok", result: { done: true } };
  }
}

class ThrowingCommand extends Command {
  name = "throw";
  async command(): Promise<SuccessResponse<unknown> | ErrorResponse> {
    this.throwException("PROJECT_NOT_FOUND", "Custom error", {
      project: "some-project",
    });
  }
}

describe("Command", () => {
  describe("runCommand", () => {
    it("returns success result when command returns SuccessResponse", async () => {
      const cmd = new TestCommand();
      const result = await cmd.runCommand(
        { outputJson: false },
      );
      expect(result).toEqual({ status: "ok", result: { done: true } });
      expect(result?.status).toBe("ok");
    });

    it("returns error result when command returns ErrorResponse", async () => {
      const errorRes: ErrorResponse = {
        status: "error",
        error: { code: "INIT_TEMPLATE_MISSING", message: "Template missing" },
      };
      const cmd = new (class extends Command {
        name = "err";
        async command() {
          return errorRes;
        }
      })();
      const result = await cmd.runCommand(
        { outputJson: false },
      );
      expect(result).toEqual(errorRes);
      expect(result?.status).toBe("error");
    });

    it("returns ErrorResponse when command throws Error", async () => {
      const previousExitCode = process.exitCode;
      const cmd = new (class extends Command {
        name = "throwErr";
        async command() {
          throw new Error("command failed");
        }
      })();
      const result = await cmd.runCommand(
        { outputJson: false },
      );
      expect(result?.status).toBe("error");
      expect((result as ErrorResponse).error.code).toBe("UNEXCEPTED_EXCEPTION");
      expect((result as ErrorResponse).error.details?.errorMessage).toBe(
        "command failed",
      );
      expect(process.exitCode).toBe(1);
      process.exitCode = previousExitCode;
    });

    it("does not set exit code when command throws Error and outputJson is true", async () => {
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      const cmd = new (class extends Command {
        name = "throwErrJson";
        async command() {
          throw new Error("command failed");
        }
      })();
      const result = await cmd.runCommand({ outputJson: true });
      expect(result?.status).toBe("error");
      expect(process.exitCode).toBeUndefined();
      process.exitCode = previousExitCode;
    });

    it("returns thrown ErrorResponse when command throws ErrorResponse", async () => {
      const errorRes: ErrorResponse = {
        status: "error",
        error: { code: "PROJECT_NOT_FOUND", message: "Custom error" },
      };
      const cmd = new (class extends Command {
        name = "throwRes";
        async command() {
          throw errorRes;
        }
      })();
      const result = await cmd.runCommand(
        { outputJson: false },
      );
      expect(result).toEqual(errorRes);
      expect((result as ErrorResponse).error.code).toBe("PROJECT_NOT_FOUND");
    });

    it("throwException throws ErrorResponse that runCommand returns", async () => {
      const cmd = new ThrowingCommand();
      const result = await cmd.runCommand(
        { outputJson: false },
      );
      expect(result?.status).toBe("error");
      expect((result as ErrorResponse).error.code).toBe("PROJECT_NOT_FOUND");
      expect((result as ErrorResponse).error.message).toBe("Custom error");
      expect((result as ErrorResponse).error.details).toEqual({
        project: "some-project",
      });
    });
  });
});
