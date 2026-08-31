declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.conf" {
  const content: string;
  export default content;
}

declare module "ejs";

/** No @types/svgdom; optional runtime dependency (see MermaidService). */
declare module "svgdom" {
  export function createHTMLWindow(): any;
}

/** Optional runtime dependency (see MermaidService). */
declare module "mermaid" {
  const mermaid: {
    initialize(config: Record<string, unknown>): void;
    render(id: string, definition: string): Promise<{ svg: string }>;
  };
  export default mermaid;
}
