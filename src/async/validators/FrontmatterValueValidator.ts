export type FrontmatterValueType = "string" | "boolean" | "number";

export type FrontmatterValueCoerceErrorCode =
  | "invalid_type"
  | "invalid_boolean"
  | "invalid_number";

export type FrontmatterValueCoerceResult =
  | { ok: true; value: string | number | boolean }
  | {
      ok: false;
      argument: "type" | "value";
      code: FrontmatterValueCoerceErrorCode;
    };

const VALID_TYPES: ReadonlySet<string> = new Set([
  "string",
  "boolean",
  "number",
]);

const BOOLEAN_TRUE = new Set(["yes", "true", "1"]);
const BOOLEAN_FALSE = new Set(["no", "false", "0"]);

export class FrontmatterValueValidator {
  static isValidType(type: string): type is FrontmatterValueType {
    return VALID_TYPES.has(type);
  }

  static coerce(type: string, raw: string): FrontmatterValueCoerceResult {
    if (!FrontmatterValueValidator.isValidType(type)) {
      return {
        ok: false,
        argument: "type",
        code: "invalid_type",
      };
    }

    switch (type) {
      case "string":
        return { ok: true, value: raw };
      case "boolean": {
        const normalized = raw.trim().toLowerCase();
        if (BOOLEAN_TRUE.has(normalized)) {
          return { ok: true, value: true };
        }
        if (BOOLEAN_FALSE.has(normalized)) {
          return { ok: true, value: false };
        }
        return {
          ok: false,
          argument: "value",
          code: "invalid_boolean",
        };
      }
      case "number": {
        if (raw.trim() === "") {
          return {
            ok: false,
            argument: "value",
            code: "invalid_number",
          };
        }
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          return {
            ok: false,
            argument: "value",
            code: "invalid_number",
          };
        }
        return { ok: true, value: parsed };
      }
    }
  }
}
