export type Theme = {
  ui: {
    borders: string;
    mutedText: string;
    primaryText: string;
  };
  accents: {
    green: string;
    cyan: string;
    orange: string;
    purple: string;
    red: string;
  };
};

export const DefaultTheme: Theme = {
  ui: {
    borders: "#888888",
    mutedText: "#888888",
    primaryText: "#E0E0E0",
  },
  accents: {
    green: "#50FA7B",
    cyan: "#8BE9FD",
    orange: "#FFB86C",
    purple: "#BD93F9",
    red: "#B33E4A",
  },
};

/** Enter-bound primary action label in dialogs (Dracula cyan / light blue). */
export const DialogConfirmColor = DefaultTheme.accents.cyan;
