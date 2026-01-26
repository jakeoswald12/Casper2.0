import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import type { Book, OutlineItem, Manuscript } from '../../drizzle/schema';

interface OutlineNode extends OutlineItem {
  children?: OutlineNode[];
}

export async function generateDocx(
  book: Book,
  outlineItems: OutlineItem[],
  manuscripts: Manuscript[]
): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // Title page
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: book.title,
          bold: true,
          size: 72, // 36pt
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  if (book.subtitle) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: book.subtitle,
            italics: true,
            size: 36, // 18pt
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      })
    );
  }

  // Add some spacing before content
  sections.push(
    new Paragraph({
      children: [],
      spacing: { after: 1200 },
    })
  );

  // Summary/Overview if exists
  if (book.summary) {
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: 'About This Book', bold: true })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const summaryParagraphs = book.summary.split('\n\n');
    for (const para of summaryParagraphs) {
      if (para.trim()) {
        sections.push(
          new Paragraph({
            children: [new TextRun(para.trim())],
            spacing: { after: 200 },
          })
        );
      }
    }

    // Page break after summary
    sections.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // Build hierarchical outline
  const outline = buildOutlineTree(outlineItems);

  // Generate content for each part/chapter
  for (const node of outline) {
    if (node.type === 'part') {
      // Part heading
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: node.content,
              bold: true,
              size: 48, // 24pt
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600, after: 300 },
          pageBreakBefore: true,
        })
      );

      // Process chapters within part
      for (const chapter of node.children || []) {
        addChapterContent(sections, chapter, manuscripts);
      }
    } else if (node.type === 'chapter') {
      // Direct chapter (no parent part)
      addChapterContent(sections, node, manuscripts);
    }
  }

  // Create document
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24, // 12pt
            font: 'Times New Roman',
          },
          paragraph: {
            spacing: {
              line: 360, // 1.5 line spacing
            },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // US Letter: 8.5 inches in twips
              height: 15840, // 11 inches in twips
            },
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: book.title,
                    italics: true,
                    size: 20,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

function addChapterContent(
  sections: Paragraph[],
  chapter: OutlineNode,
  manuscripts: Manuscript[]
): void {
  // Chapter heading
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: chapter.content,
          bold: true,
          size: 36, // 18pt
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
      pageBreakBefore: true,
    })
  );

  // Chapter content from manuscript
  const manuscript = manuscripts.find((m) => m.chapterId === chapter.id);
  if (manuscript && manuscript.content) {
    const paragraphs = parseManuscriptContent(manuscript.content);
    sections.push(...paragraphs);
  }

  // Process subsections
  for (const subsection of chapter.children || []) {
    if (subsection.type === 'subsection') {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: subsection.content,
              bold: true,
              size: 28, // 14pt
            }),
          ],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 },
        })
      );
    }
  }
}

function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const itemMap = new Map<string, OutlineNode>();
  const roots: OutlineNode[] = [];

  // Create map with children arrays
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Build tree
  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children!.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort by position
  const sortByPosition = (a: OutlineNode, b: OutlineNode) =>
    a.position - b.position;
  roots.sort(sortByPosition);
  roots.forEach((root) => {
    if (root.children) {
      root.children.sort(sortByPosition);
      root.children.forEach((child) => {
        if (child.children) {
          child.children.sort(sortByPosition);
        }
      });
    }
  });

  return roots;
}

function parseManuscriptContent(content: string): Paragraph[] {
  let text = content;

  // Try to parse as Lexical JSON
  try {
    const json = JSON.parse(content);
    text = extractTextFromLexical(json);
  } catch {
    // Already plain text, use as-is
  }

  // Split into paragraphs
  const paragraphs = text.split('\n\n').filter((p) => p.trim());

  return paragraphs.map(
    (p) =>
      new Paragraph({
        children: [new TextRun(p.trim())],
        spacing: { after: 200 },
      })
  );
}

function extractTextFromLexical(json: any): string {
  let text = '';

  if (json.root && json.root.children) {
    for (const node of json.root.children) {
      text += extractNodeText(node);
    }
  }

  return text.trim();
}

function extractNodeText(node: any): string {
  let text = '';

  if (node.type === 'paragraph' || node.type === 'heading') {
    if (node.children) {
      for (const child of node.children) {
        if (child.text) {
          text += child.text;
        } else if (child.children) {
          text += extractNodeText(child);
        }
      }
    }
    text += '\n\n';
  } else if (node.type === 'list') {
    if (node.children) {
      for (const listItem of node.children) {
        text += '• ';
        if (listItem.children) {
          for (const child of listItem.children) {
            if (child.text) {
              text += child.text;
            }
          }
        }
        text += '\n';
      }
      text += '\n';
    }
  } else if (node.type === 'quote') {
    if (node.children) {
      text += '"';
      for (const child of node.children) {
        if (child.text) {
          text += child.text;
        }
      }
      text += '"\n\n';
    }
  }

  return text;
}
