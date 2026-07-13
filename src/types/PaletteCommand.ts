export type PaletteCommand = {
  label: string;
  /** Unique command id for MRU and list identity. */
  key: string;
  /** Optional keyboard shortcut shown as label<shortcutKey> in the palette (e.g. "c+c", "Esc"). */
  shortcutKey?: string;
  callback: () => Promise<unknown>;
  description?: string;
  /** When true, row is shown dimmed and cannot be activated. */
  isDisabled?: boolean;
};

/** Preferred entry for wrapping a palette command; use instead of `new PaletteCommandAccessor`. */
export function accessPaletteCommand(
  data: PaletteCommand,
): PaletteCommandAccessor {
  return new PaletteCommandAccessor(data);
}

/** Single command accessor; query helpers for palette filtering. Prefer {@link accessPaletteCommand}. */
export class PaletteCommandAccessor {
  private readonly data: PaletteCommand;

  constructor(data: PaletteCommand) {
    this.data = data;
  }

  get(): PaletteCommand {
    return this.data;
  }

  /** Match when `normalizedQuery` (trimmed + lowercased) is a substring of key, label, or description. */
  matchesNormalizedQuery(normalizedQuery: string): boolean {
    if (normalizedQuery === "") return true;
    const { key, label, description, shortcutKey } = this.data;
    return [key, label, description ?? "", shortcutKey ?? ""].some((field) =>
      field.toLowerCase().includes(normalizedQuery),
    );
  }
}

/** Preferred entry for wrapping a palette command list; use instead of `new PaletteCommandListAccessor`. */
export function accessPaletteCommandList(
  commands: readonly PaletteCommand[],
): PaletteCommandListAccessor {
  return new PaletteCommandListAccessor(commands);
}

/** Read-only list of commands with palette-style filtering. Prefer {@link accessPaletteCommandList}. */
export class PaletteCommandListAccessor {
  private readonly commands: readonly PaletteCommand[];

  constructor(commands: readonly PaletteCommand[]) {
    this.commands = commands;
  }

  /** All commands when query is blank; otherwise substring match on key, label, description. */
  filterMatchingQuery(query: string): PaletteCommand[] {
    const q = query.trim().toLowerCase();
    if (q === "") return [...this.commands];
    return this.commands.filter((item) =>
      accessPaletteCommand(item).matchesNormalizedQuery(q),
    );
  }

  /** True when every key is non-empty and distinct. */
  hasUniqueKeys(): boolean {
    const keys = this.commands.map((c) => c.key);
    if (keys.some((k) => k.trim() === "")) return false;
    return new Set(keys).size === keys.length;
  }

  /**
   * Copy of commands with the entry matching lastUsedKey moved to index 0.
   * No-op when lastUsedKey is null, blank, not found, or already first.
   */
  withLastUsedKeyFirst(lastUsedKey: string | null): PaletteCommand[] {
    if (lastUsedKey == null || lastUsedKey.trim() === "") {
      return [...this.commands];
    }
    const index = this.commands.findIndex((c) => c.key === lastUsedKey);
    if (index <= 0) {
      return [...this.commands];
    }
    const match = this.commands[index];
    if (match == null) {
      return [...this.commands];
    }
    return [
      match,
      ...this.commands.slice(0, index),
      ...this.commands.slice(index + 1),
    ];
  }
}
