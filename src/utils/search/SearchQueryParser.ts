import { parse, SyntaxError } from "liqe";
import { ParsedSearchTermAccessor } from "./types.ts";
import type { ParsedSearchTerm } from "./types.ts";

function preprocessQuery(query: string): string {
  const commaExpanded = preprocessCommaOr(query);
  return quoteRelativeDateValues(commaExpanded);
}

function quoteRelativeDateValues(query: string): string {
  return query.replace(
    /\b(after|before|date):([+-]?\d+[dwmy])\b/gi,
    (_, field, value) => `${field}:"${value}"`,
  );
}

/**
 * Expands field:val1,val2 to field:val1 OR field:val2 so liqe can parse it.
 * Only expands commas within the value part after a colon to avoid breaking quoted commas.
 */
function preprocessCommaOr(query: string): string {
  const tokens: string[] = [];
  let i = 0;
  while (i < query.length) {
    while (i < query.length && /[\s\t]/.test(query[i])) i++;
    if (i >= query.length) break;
    let token = "";
    if (query[i] === '"' || query[i] === "'") {
      const q = query[i];
      token += query[i++];
      while (i < query.length && query[i] !== q) {
        token += query[i];
        if (query[i] === "\\") i++;
        i++;
      }
      if (i < query.length) token += query[i++];
      tokens.push(token);
      continue;
    }
    while (i < query.length && !/[\s\t]/.test(query[i])) {
      if (query[i] === '"' || query[i] === "'") {
        const q = query[i];
        token += query[i++];
        while (i < query.length && query[i] !== q) {
          token += query[i];
          if (query[i] === "\\") i++;
          i++;
        }
        if (i < query.length) token += query[i++];
        continue;
      }
      token += query[i++];
    }
    if (token) tokens.push(token);
  }

  const expanded = tokens.map((t) => {
    const colonIdx = t.indexOf(":");
    if (colonIdx === -1) return t;
    const field = t.slice(0, colonIdx + 1);
    const valuePart = t.slice(colonIdx + 1);
    const segments: string[] = [];
    let segStart = 0;
    for (let j = 0; j <= valuePart.length; j++) {
      if (j === valuePart.length || valuePart[j] === ",") {
        segments.push(valuePart.slice(segStart, j).trim());
        segStart = j + 1;
      }
    }
    if (segments.length <= 1) return t;
    return segments
      .map((s) => {
        const needsQuotes = s.includes(":") || s.includes(" ");
        const escaped = needsQuotes ? `"${s.replace(/"/g, '\\"')}"` : s;
        return field + escaped;
      })
      .join(" OR ");
  });

  return expanded.join(" ");
}

export class SearchQueryParser {
  public parse(query: string): ParsedSearchTerm[] {
    const preprocessed = preprocessQuery(query.trim());
    try {
      const ast = parse(preprocessed);
      return ParsedSearchTermAccessor.fromLiqe(ast);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return [];
      }
      throw err;
    }
  }
}
