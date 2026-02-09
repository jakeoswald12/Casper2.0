import {
  DecoratorNode,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { ReactNode } from 'react';
import { Bookmark } from 'lucide-react';

export type SerializedSectionMarkerNode = Spread<
  {
    sectionId: string;
    sectionTitle: string;
  },
  SerializedLexicalNode
>;

export class SectionMarkerNode extends DecoratorNode<ReactNode> {
  __sectionId: string;
  __sectionTitle: string;

  static getType(): string {
    return 'section-marker';
  }

  static clone(node: SectionMarkerNode): SectionMarkerNode {
    return new SectionMarkerNode(
      node.__sectionId,
      node.__sectionTitle,
      node.__key
    );
  }

  constructor(sectionId: string, sectionTitle: string, key?: NodeKey) {
    super(key);
    this.__sectionId = sectionId;
    this.__sectionTitle = sectionTitle;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section-marker-wrapper';
    div.setAttribute('data-section-id', this.__sectionId);
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-section-id', this.__sectionId);
    element.setAttribute('data-section-title', this.__sectionTitle);
    element.className = 'section-marker';
    element.textContent = `[Section: ${this.__sectionTitle}]`;
    return { element };
  }

  static importJSON(serializedNode: SerializedSectionMarkerNode): SectionMarkerNode {
    return new SectionMarkerNode(
      serializedNode.sectionId,
      serializedNode.sectionTitle
    );
  }

  exportJSON(): SerializedSectionMarkerNode {
    return {
      type: 'section-marker',
      version: 1,
      sectionId: this.__sectionId,
      sectionTitle: this.__sectionTitle,
    };
  }

  decorate(): ReactNode {
    return (
      <div
        className="flex items-center gap-2 py-2 px-3 my-4 bg-primary/5 rounded-md border-l-4 border-primary select-none"
        data-section-id={this.__sectionId}
        contentEditable={false}
      >
        <Bookmark className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono text-muted-foreground">
          #{this.__sectionId.slice(0, 8)}
        </span>
        <span className="text-sm font-medium text-foreground">
          {this.__sectionTitle}
        </span>
      </div>
    );
  }

  getSectionId(): string {
    return this.__sectionId;
  }

  getSectionTitle(): string {
    return this.__sectionTitle;
  }

  setSectionTitle(title: string): void {
    const writable = this.getWritable();
    writable.__sectionTitle = title;
  }

  isInline(): boolean {
    return false;
  }
}

export function $createSectionMarkerNode(
  sectionId: string,
  sectionTitle: string
): SectionMarkerNode {
  return new SectionMarkerNode(sectionId, sectionTitle);
}

export function $isSectionMarkerNode(
  node: LexicalNode | null | undefined
): node is SectionMarkerNode {
  return node instanceof SectionMarkerNode;
}
