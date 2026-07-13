import { describe, it, expect } from "@jest/globals";
import {
  ErrorResponseAccessor,
  type SuccessResponse,
  type ErrorResponse,
} from "../../src/types/Response.ts";

describe("Response types", () => {
  describe("SuccessResponse", () => {
    it("has status ok and result", () => {
      const res: SuccessResponse<{ version: string }> = {
        status: "ok",
        result: { version: "1.0.0" },
      };
      expect(res.status).toBe("ok");
      expect(res.result.version).toBe("1.0.0");
    });
  });

  describe("ErrorResponse", () => {
    it("has status error and error payload", () => {
      const res: ErrorResponse = {
        status: "error",
        error: {
          code: "INIT_TEMPLATE_MISSING",
          message: "Template could not be loaded.",
          details: { template: "mudconf" },
        },
      };
      expect(res.status).toBe("error");
      expect(res.error.code).toBe("INIT_TEMPLATE_MISSING");
      expect(res.error.message).toBe("Template could not be loaded.");
      expect(res.error.details).toEqual({ template: "mudconf" });
    });
  });

  describe("ErrorResponseAccessor", () => {
    it("fromError(error).get() returns ErrorResponse with UNEXCEPTED_EXCEPTION shape", () => {
      const err = new Error("Something broke");
      const response = ErrorResponseAccessor.fromError(err).get();
      expect(response.status).toBe("error");
      expect(response.error.code).toBe("UNEXCEPTED_EXCEPTION");
      expect(response.error.details).toEqual({ errorMessage: "Something broke" });
    });

    it("fromError() uses message for non-Error throwables", () => {
      const response = ErrorResponseAccessor.fromError(
        new Error("custom message"),
      ).get();
      expect(response.error.details?.errorMessage).toBe("custom message");
    });

    it("get() returns plain ErrorResponse POJO", () => {
      const err = new Error("test");
      const first = ErrorResponseAccessor.fromError(err).get();
      const second = ErrorResponseAccessor.fromError(err).get();
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

});
