import type { FileService } from "./FileService.ts";

/**
 * Renders Mermaid (e.g. gitGraph) to SVG via the `mermaid` package with {@link https://www.npmjs.com/package/svgdom svgdom},
 * then rasterizes with {@link https://sharp.pixelplumbing.com/ sharp}.
 */
export class MermaidService {
  private static instance: MermaidService | null = null;

  private static svgdomInstalled = false;
  private static mermaidInitialized = false;

  static getInstance(): MermaidService {
    MermaidService.instance ??= new MermaidService();
    return MermaidService.instance;
  }

  static setInstance(instance: MermaidService | null): void {
    MermaidService.instance = instance;
  }

  private async installSvgdomGlobals(): Promise<void> {
    if (MermaidService.svgdomInstalled) {
      return;
    }
    const { createHTMLWindow } = await import("svgdom");
    const window = createHTMLWindow();
    Object.assign(globalThis, {
      window,
      document: window.document,
      DOMParser: window.DOMParser,
      Node: window.Node,
    });
    MermaidService.svgdomInstalled = true;
  }

  async renderMermaidToSvg(definition: string): Promise<string> {
    await this.installSvgdomGlobals();
    const mermaid = (await import("mermaid")).default;
    if (!MermaidService.mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "default",
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        gitGraph: {},
      });
      MermaidService.mermaidInitialized = true;
    }
    const id = `mudissue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const out = await mermaid.render(id, definition);
    return out.svg;
  }

  async writePngFromSvg(
    svg: string,
    absOutputPath: string,
    fileService: FileService,
  ): Promise<void> {
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
    await fileService.writeFile(absOutputPath, png);
  }

  async writeMermaidToPng(
    definition: string,
    absOutputPath: string,
    fileService: FileService,
  ): Promise<void> {
    const svg = await this.renderMermaidToSvg(definition);
    await this.writePngFromSvg(svg, absOutputPath, fileService);
  }
}
