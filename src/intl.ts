import { createIntl, createIntlCache } from "react-intl";

export const intl = createIntl(
  {
    locale: "en",
    defaultLocale: "en",
    messages: {},
  },
  createIntlCache(),
);
