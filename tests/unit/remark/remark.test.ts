import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root } from 'unist';
import type { Heading, Code, ListItem } from 'mdast';

describe('Remark Markdown Parser Evaluation', () => {

  const processor = remark().use(remarkGfm);

  describe('Heading Identification', () => {
    it('should identify all 6 heading levels and their correct line numbers', () => {
      const markdown = 
`# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;
      const ast = processor.parse(markdown);
      const headings: { level: number; line: number | undefined; text: string }[] = [];

      visit(ast, 'heading', (node: Heading) => {
        headings.push({
          level: node.depth,
          line: node.position?.start.line,
          text: (node.children[0] as any).value
        });
      });

      expect(headings).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(headings[i].level).toBe(i + 1);
        expect(headings[i].line).toBe(i + 1);
        expect(headings[i].text).toBe(`Heading ${i + 1}`);
      }
    });
  });

  describe('Code Block Identification', () => {
    const markdown = '```js\n' +
      'function hello() {\n' +
      '  console.log("Hello, world!");\n' +
      '}\n' +
      '```';
    const ast = processor.parse(markdown);
    // console.log(JSON.stringify(ast, null, 2)); // Enable for debugging
    let codeBlock: Code | undefined;

    visit(ast, 'code', (node: Code) => {
      codeBlock = node;
    });

    it('should identify a fenced code block', () => {
        expect(codeBlock).toBeDefined();
        expect(codeBlock?.lang).toBe('js');
    });

    it('should report correct starting and ending line numbers', () => {
        expect(codeBlock?.position?.start.line).toBe(1);
        expect(codeBlock?.position?.end.line).toBe(5);
    });

    it('should report correct starting and ending character offsets', () => {
        expect(codeBlock?.position?.start.offset).toBe(0);
        expect(codeBlock?.position?.end.offset).toBe(62);
    });
  });

  describe('Checkbox Identification', () => {
    const markdown = 
`- [x] Checked item
- [ ] Unchecked item
- [ ] Another unchecked item
- [x] Another checked item`;
    const ast = processor.parse(markdown);
    const checkboxes: { checked: boolean | null; line: number | undefined }[] = [];

    visit(ast, 'listItem', (node: ListItem) => {
        if (typeof node.checked === 'boolean') {
            checkboxes.push({
                checked: node.checked,
                line: node.position?.start.line
            });
        }
    });

    it('should identify all checkbox items', () => {
        expect(checkboxes).toHaveLength(4);
    });

    it('should correctly distinguish between checked and unchecked states', () => {
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].checked).toBe(false);
        expect(checkboxes[2].checked).toBe(false);
        expect(checkboxes[3].checked).toBe(true);
    });
  });

  describe('Nested Code Block Identification', () => {
    const markdown = '````markdown\n' +
      '```js\n' +
      'console.log("inner");\n' +
      '```\n' +
      '````';
    const ast = processor.parse(markdown);
    const codeBlocks: Code[] = [];

    visit(ast, 'code', (node: Code) => {
        codeBlocks.push(node);
    });

    it('should identify the outer code block', () => {
        expect(codeBlocks).toHaveLength(1);
        const outerBlock = codeBlocks[0];
        expect(outerBlock.lang).toBe('markdown');
        expect(outerBlock.value).toContain('```js');
        expect(outerBlock.value).toContain('console.log("inner");');
        expect(outerBlock.value).toContain('```');
    });

    it('should treat the inner code block as literal content of the outer one', () => {
        const astOfOuterBlockContent = processor.parse(codeBlocks[0].value);
        let innerCodeBlock: Code | undefined;
        visit(astOfOuterBlockContent, 'code', (node: Code) => {
            innerCodeBlock = node;
        });
        expect(innerCodeBlock).toBeDefined();
        expect(innerCodeBlock?.lang).toBe('js');
        expect(innerCodeBlock?.value).toBe('console.log("inner");');
    });
  });
});
