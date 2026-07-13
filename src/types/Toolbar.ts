/** Toolbar entry for footer shortcuts and keyboard-help listing. */
export type ToolbarConfigItem = {
  label: string;
  /** Logical shortcut, e.g. "Esc", "Enter", "Up", "/", "c+c", "c+PgUp", "p" */
  key: string;
  /** Invoked when the shortcut matches or the item is activated from the help dialog. */
  callback: () => void;
  /** Shown in the toolbar help dialog; defaults to visible when omitted. */
  description?: string;
  /** Omit from help listing when false. */
  showInHelpDialog?: boolean;
  isDisabled?: boolean;
  isHidden?: boolean;
  /** Ink/chalk color (hex or named). Applied when item is not disabled. */
  color?: string;
};

/** Preferred entry for wrapping a toolbar config list; use instead of `new ToolbarConfigListAccessor`. */
export function accessToolbarConfigList(
  items: readonly ToolbarConfigItem[],
): ToolbarConfigListAccessor {
  return new ToolbarConfigListAccessor(items);
}

/** Read-only list of toolbar items with help-style filtering. Prefer {@link accessToolbarConfigList}. */
export class ToolbarConfigListAccessor {
  private readonly items: readonly ToolbarConfigItem[];

  constructor(items: readonly ToolbarConfigItem[]) {
    this.items = items;
  }

  /** Help-visible items when query is blank; otherwise substring match on key, label, or description. */
  filterForHelp(query: string): ToolbarConfigItem[] {
    const base = this.items.filter(
      (item) => !item.isHidden && item.showInHelpDialog !== false,
    );
    const q = query.trim().toLowerCase();
    if (q === "") return base;

    return base.filter((item) =>
      [item.key, item.label, item.description ?? ""].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }
}
