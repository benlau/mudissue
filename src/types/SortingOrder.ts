import { z } from "zod";

export type SortingOrderField =
  | "id"
  | "title"
  | "status"
  | "priority"
  | "created_at"
  | "updated_at";

export type SortingOrder = {
  field: SortingOrderField | string;
  order: "asc" | "desc";
};

export type SortingOrderList = SortingOrder[];

export const DEFAULT_SORTING_ORDER: SortingOrder = {
  field: "updated_at",
  order: "desc",
};

export const SortingOrderSchema = z.object({
  field: z.enum([
    "id",
    "title",
    "status",
    "priority",
    "created_at",
    "updated_at",
  ]),
  order: z.enum(["asc", "desc"]),
});

export class SortingOrderAccessor {
  private data: SortingOrder;

  private constructor(data: SortingOrder) {
    this.data = data;
  }

  static parse(token: string): SortingOrderAccessor | undefined {
    const trimmed = token.trim();
    if (trimmed === "") {
      return undefined;
    }

    let order: SortingOrder["order"] = "asc";
    let fieldPart = trimmed;

    if (trimmed.startsWith("+")) {
      fieldPart = trimmed.slice(1).trim();
    } else if (trimmed.startsWith("-")) {
      order = "desc";
      fieldPart = trimmed.slice(1).trim();
    }

    if (fieldPart === "") {
      return undefined;
    }

    return new SortingOrderAccessor({ field: fieldPart, order });
  }

  static from(data: SortingOrder): SortingOrderAccessor {
    const parsed = SortingOrderSchema.safeParse(data);
    if (!parsed.success) {
      return new SortingOrderAccessor({ ...DEFAULT_SORTING_ORDER });
    }
    return new SortingOrderAccessor(parsed.data);
  }

  static parseJson(value: string | undefined): SortingOrderAccessor {
    if (value === undefined || value.trim() === "") {
      return new SortingOrderAccessor({ ...DEFAULT_SORTING_ORDER });
    }
    try {
      const raw = JSON.parse(value) as unknown;
      const parsed = SortingOrderSchema.safeParse(raw);
      if (!parsed.success) {
        return new SortingOrderAccessor({ ...DEFAULT_SORTING_ORDER });
      }
      return new SortingOrderAccessor(parsed.data);
    } catch {
      return new SortingOrderAccessor({ ...DEFAULT_SORTING_ORDER });
    }
  }

  get(): SortingOrder {
    return this.data;
  }
}

export class SortingOrderListAccessor {
  private data: SortingOrderList;

  constructor(data: SortingOrderList) {
    this.data = data;
  }

  static parse(spec: string): SortingOrderListAccessor {
    const trimmed = spec.trim();
    if (trimmed === "") {
      return new SortingOrderListAccessor([]);
    }

    const orders: SortingOrder[] = [];
    for (const token of trimmed.split(",")) {
      const parsed = SortingOrderAccessor.parse(token);
      if (parsed != null) {
        orders.push(parsed.get());
      }
    }

    return new SortingOrderListAccessor(orders);
  }

  static from(data: SortingOrderList): SortingOrderListAccessor {
    return new SortingOrderListAccessor([...data]);
  }

  get(): SortingOrderList {
    return this.data;
  }
}

export function accessSortingOrder(data?: SortingOrder): SortingOrderAccessor {
  return data != null
    ? SortingOrderAccessor.from(data)
    : SortingOrderAccessor.from(DEFAULT_SORTING_ORDER);
}

export function accessSortingOrderList(
  data?: SortingOrderList,
): SortingOrderListAccessor {
  return SortingOrderListAccessor.from(data ?? []);
}
