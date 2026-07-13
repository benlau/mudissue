import type { ZodError } from "zod";

export class ZodErrorFormatter {
  static format(error: ZodError): string {
    return error.issues
      .map((issue) => {
        const field =
          issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
        return `${field}: ${issue.message}`;
      })
      .join("; ");
  }
}
