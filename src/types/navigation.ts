import { ISSUE_TABLE_PAGE, type Page } from "./page.ts";

export type NavigationStack = Page[];

export const INITIAL_NAVIGATION_STACK: NavigationStack = [ISSUE_TABLE_PAGE];

export class NavigationStackAccessor {
  private data: NavigationStack;

  constructor(data: NavigationStack) {
    this.data = data;
  }

  push(page: Page): NavigationStackAccessor {
    this.data = [...this.data, page];
    return this;
  }

  pop(): NavigationStackAccessor {
    if (this.data.length <= 1) {
      return this;
    }
    this.data = this.data.slice(0, -1);
    return this;
  }

  replaceTop(page: Page): NavigationStackAccessor {
    if (this.data.length === 0) {
      return this.push(page);
    }
    this.data = [...this.data.slice(0, -1), page];
    return this;
  }

  resetToTable(): NavigationStackAccessor {
    this.data = [ISSUE_TABLE_PAGE];
    return this;
  }

  getCurrentPage(): Page {
    return this.data[this.data.length - 1] ?? ISSUE_TABLE_PAGE;
  }

  canGoBack(): boolean {
    return this.data.length > 1;
  }

  get(): NavigationStack {
    return this.data;
  }
}

export function accessNavigationStack(
  data?: NavigationStack,
): NavigationStackAccessor {
  return new NavigationStackAccessor(data ?? INITIAL_NAVIGATION_STACK);
}
