import { format as formatDate, parse as parseDate } from "date-fns";

export type DateFormatType =
  | "created_at"
  | "log_timestamp"
  | "comment_timestamp";

const FORMATS: Record<DateFormatType, string> = {
  created_at: "yyyy-MM-dd HH:mm XXX",
  log_timestamp: "yyyyMMdd-HHmmss",
  comment_timestamp: "yyyy-MM-dd h:mm a",
};

/**
 * Formats tried in order when auto-detecting.
 * Only year-month-first patterns are included; ambiguous day/month-first
 * patterns are intentionally excluded.
 */
const AUTO_DETECT_FORMATS: string[] = [
  "yyyy-MM-dd HH:mm XXX",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd'T'HH:mmXXX",
  "yyyy-MM-dd'T'HH:mm",
  "yyyy-MM-dd",
  "yyyy/MM/dd HH:mm",
  "yyyy/MM/dd",
  "yyyyMMdd HHmm",
  "yyyyMMdd HHmm XXX",
];

/**
 * Formats and parses dates. Use created_at for frontmatter; log_timestamp for debug log lines.
 */
export class DateFormatter {
  static format(date: Date, type: DateFormatType = "created_at"): string {
    return formatDate(date, FORMATS[type]);
  }

  static parse(str: string, format?: string): Date | null {
    if (typeof str !== "string" || str.trim() === "") {
      return null;
    }
    const trimmed = str.trim();
    const formats = format !== undefined ? [format] : AUTO_DETECT_FORMATS;
    const ref = new Date();

    for (const fmt of formats) {
      try {
        const parsed = parseDate(trimmed, fmt, ref);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        // try next format
      }
    }

    const guessed = new Date(trimmed);
    return Number.isNaN(guessed.getTime()) ? null : guessed;
  }
}
