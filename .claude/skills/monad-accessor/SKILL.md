---
name: monad-accessor
description: Defines the Monad Accessor pattern for wrapping POJOs with immutable-update helpers. Use when designing or implementing accessor classes over plain objects, when applying immutable updates for React/Redux state, or when the user mentions monad accessor, POJO accessor, or immutable update helpers.
---

# Monad accessor POJOs in `src/types/`

# Monad Accessor

A monad accessor wraps a POJO and exposes helper methods that **transform** the object using the **immutable update pattern**. The unwrapped result can be assigned directly to React/Redux state.

## Four Operations

| Operation     | Purpose                                                         |
| ------------- | --------------------------------------------------------------- |
| **Wrap**      | Convert a POJO into the accessor (constructor or static method) |
| **Unwrap**    | Convert the accessor back to the POJO (e.g. `get()`)            |
| **Transform** | Update the POJO immutably; return `this` for chaining           |
| **Query**     | Read from the POJO without mutating it                          |

## Structure

- Store the POJO in a **single private property** (e.g. `data`). Treat it as **immutable**; callers must not mutate it.
- **Wrap**: constructor or a small helper that takes the POJO (or defaults) and returns a new accessor instance.
- **Unwrap**: expose the POJO via a getter method (e.g. `data()`) so callers can pass it to `setState` / Redux.
- **Transform** methods: replace `this.data` with a new object (spread/copy), then `return this` for chaining.
- **Query** methods: return values from `this.data` without changing it.

## Example

```typescript
type Invoice = {
  id: string;
  items: { name: string; qty: number; amount: number }[];
};

class InvoiceAccessor {
  private data: Invoice;

  constructor(data: Invoice) {
    this.data = data;
  }

  get(): Invoice {
    return this.data;
  }

  addItem(name: string, qty: number, amount: number) {
    this.data = {
      ...this.data,
      items: [...this.data.items, { name, qty, amount }],
    };
    return this;
  }

  getItem(index: number) {
    return this.data.items[index];
  }
}

function accessInvoice(data?: Invoice) {
  return new InvoiceAccessor(data ?? { id: "", items: [] });
}

// Usage: wrap → transform (chain) → unwrap → set state
const newInvoice = accessInvoice({ id: "123", items: [] })
  .addItem("Apple", 10, 100)
  .addItem("Orange", 20, 200)
  .data();
setInvoice(newInvoice);
```

## Best Practices
 
- **Co-locate types**: Define the POJO type and its accessor class in the same file (e.g. `types/xxxx.ts`).
- **Immutable updates**: In transform methods, always assign a **new** object to `this.data` (e.g. spread, copy of nested arrays/objects). Optionally use **immer** if the project allows it.
- **Chaining**: Have transform methods `return this` so callers can chain and then call `data()` once at the end.

### Bad Examples

**Storing multiple fields:** An accessor should only store a single data object. It is a utility to process data, not a long term storage class.

```typescript
class CustomTypeAccessor {
  private readonly data: CustomType;
  private readonly extra_field: string; // BAD: Accessor should wrap a single POJO
}
```

**Holding as state:** Do not store accessor instances in other classes. Use them transiently for transformations.

```typescript
class SomeOtherClass {
  getCustomTypeAccessor() : CustomTypeAccessor; // BAD: Monad accessor is for processing, not storage
}
```


## Prefer accessors over utils

- Put **transform** and **query** logic on the accessor for the POJO it operates on (e.g. `IssueFolderListAccessor.sortBy`, `SortingOrderAccessor.parseJson`).
- **Do not** add new `src/async/` modules for behavior that belongs to a single POJO type. Keep comparators and rank-map builders as **private methods** on the accessor, or file-local helpers in the same `src/types/` file.
- Add a util module only when logic is genuinely **cross-cutting** and not tied to one POJO (and no accessor owns it).
