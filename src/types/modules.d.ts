declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.conf" {
  const content: string;
  export default content;
}

declare module "ejs";

/** No @types/svgdom; runtime provides a minimal DOM (see MermaidService). */
declare module "svgdom" {
  export function createHTMLWindow(): any;
}
