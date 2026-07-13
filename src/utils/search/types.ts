import type {
  ExpressionToken,
  LiteralExpressionToken,
  LiqeQuery,
  LogicalExpressionToken,
  ParserAst,
  TagToken,
  UnaryOperatorToken,
} from "liqe";

export type ParsedSearchTerm = {
  type: string;
  value: string;
  negated: boolean;
  terms?: ParsedSearchTerm[];
  date?: Date;
  dateRange?: { start: Date; end: Date };
  size?: { op: "lt" | "gt" | "eq"; bytes: number };
};

const TAG_FIELD_NAMES = new Set(["tag"]);
const RELATIVE_DATE_FIELDS = new Set(["after", "before", "date"]);

function isLiteralExpression(
  expr: ExpressionToken,
): expr is LiteralExpressionToken {
  return expr.type === "LiteralExpression";
}

function resolveRelativeDate(value: string): Date | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^([+-]?\d+)([dwmy])$/i);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const now = new Date();
  const d = new Date(now);
  if (unit === "d") d.setDate(d.getDate() + n);
  else if (unit === "w") d.setDate(d.getDate() + n * 7);
  else if (unit === "m") d.setMonth(d.getMonth() + n);
  else if (unit === "y") d.setFullYear(d.getFullYear() + n);
  return d;
}

function literalValue(expr: LiteralExpressionToken): string {
  const v = expr.value;
  if (typeof v === "string") return v;
  if (v === null) return "null";
  return String(v);
}

function astToTerms(ast: ParserAst): ParsedSearchTerm[] {
  if (ast.type === "EmptyExpression") {
    return [];
  }

  if (ast.type === "UnaryOperator") {
    const inner = astToTerms((ast as UnaryOperatorToken).operand);
    if (inner.length === 0) return [];
    if (inner.length === 1) {
      return [{ ...inner[0], negated: !inner[0].negated }];
    }
    return [
      {
        type: "group",
        value: "AND",
        negated: true,
        terms: inner,
      },
    ];
  }

  if (ast.type === "LogicalExpression") {
    const log = ast as LogicalExpressionToken;
    const op =
      log.operator.operator ?? (log.operator as { operator?: string }).operator;
    const leftTerms = astToTerms(log.left);
    const rightTerms = astToTerms(log.right);
    if (op === "OR") {
      const flat: ParsedSearchTerm[] = [];
      for (const t of leftTerms) {
        if (t.type === "or" && !t.negated && t.terms) flat.push(...t.terms);
        else flat.push(t);
      }
      for (const t of rightTerms) {
        if (t.type === "or" && !t.negated && t.terms) flat.push(...t.terms);
        else flat.push(t);
      }
      return [{ type: "or", value: "OR", negated: false, terms: flat }];
    }
    return [
      {
        type: "group",
        value: "AND",
        negated: false,
        terms: [...leftTerms, ...rightTerms],
      },
    ];
  }

  if (ast.type === "ParenthesizedExpression") {
    return astToTerms(ast.expression);
  }

  if (ast.type === "Tag") {
    const tag = ast as TagToken;
    const field = tag.field;
    const isImplicitField = field.type === "ImplicitField";
    const fieldName = field.type === "Field" ? field.name : "";
    const type = isImplicitField
      ? "text"
      : TAG_FIELD_NAMES.has(fieldName)
        ? "tag"
        : fieldName;

    const expr = tag.expression;
    if (!isLiteralExpression(expr)) {
      const valueStr =
        expr.type === "RangeExpression"
          ? `[${expr.range.min} TO ${expr.range.max}]`
          : String(expr);
      return [
        {
          type: type || "text",
          value: valueStr,
          negated: false,
        },
      ];
    }

    const isQuoted = expr.quoted === true;
    if (isImplicitField) {
      return [
        {
          type: isQuoted ? "phrase" : "text",
          value: literalValue(expr),
          negated: false,
        },
      ];
    }

    let value = literalValue(expr);
    const compOp = tag.operator?.operator;
    if (compOp && compOp !== ":") {
      const prefix =
        compOp === ":>"
          ? ">"
          : compOp === ":>="
            ? ">="
            : compOp === ":<"
              ? "<"
              : compOp === ":<="
                ? "<="
                : compOp === ":="
                  ? ""
                  : "";
      if (prefix) value = prefix + value;
    }

    const term: ParsedSearchTerm = { type, value, negated: false };

    if (RELATIVE_DATE_FIELDS.has(fieldName)) {
      const resolved = resolveRelativeDate(value.replace(/^[><=]+/, "").trim());
      if (resolved) term.date = resolved;
    }

    return [term];
  }

  return [];
}

export class ParsedSearchTermAccessor {
  private data: ParsedSearchTerm;

  constructor(data: ParsedSearchTerm) {
    this.data = data;
  }

  get(): ParsedSearchTerm {
    return this.data;
  }

  static fromLiqe(ast: LiqeQuery): ParsedSearchTerm[] {
    const terms = astToTerms(ast as ParserAst);
    return ParsedSearchTermAccessor.flattenGroups(terms);
  }

  private static flattenGroups(terms: ParsedSearchTerm[]): ParsedSearchTerm[] {
    const out: ParsedSearchTerm[] = [];
    for (const t of terms) {
      if (t.type === "group" && t.terms) {
        out.push(...ParsedSearchTermAccessor.flattenGroups(t.terms));
      } else {
        out.push(t);
      }
    }
    return out;
  }
}

export function accessParsedSearchTerm(
  term?: ParsedSearchTerm,
): ParsedSearchTermAccessor {
  return new ParsedSearchTermAccessor(
    term ?? { type: "text", value: "", negated: false },
  );
}
