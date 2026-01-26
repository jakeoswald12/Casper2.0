import { useState, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { EditorState, $getRoot } from 'lexical';

// Custom nodes
import { SectionMarkerNode } from './nodes/SectionMarkerNode';

// Plugins
import { SectionMarkerPlugin } from './plugins/SectionMarkerPlugin';
import { AIIntegrationPlugin } from './plugins/AIIntegrationPlugin';
import { AutoSavePlugin } from './plugins/AutoSavePlugin';
import { ToolbarPlugin } from './plugins/ToolbarPlugin';
import { InitialContentPlugin } from './plugins/InitialContentPlugin';

interface ManuscriptEditorProps {
  bookId: number;
  chapterId: string;
  chapterTitle?: string;
  initialContent?: string;
  onContentChange?: (content: string, wordCount: number) => void;
  readOnly?: boolean;
}

const theme = {
  heading: {
    h1: 'text-3xl font-bold mt-8 mb-4 text-foreground',
    h2: 'text-2xl font-bold mt-6 mb-3 text-foreground',
    h3: 'text-xl font-semibold mt-5 mb-2 text-foreground',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
  },
  paragraph: 'mb-4 leading-relaxed text-foreground',
  list: {
    ul: 'list-disc ml-6 mb-4',
    ol: 'list-decimal ml-6 mb-4',
    listitem: 'mb-1',
    nested: {
      listitem: 'list-none',
    },
  },
  quote: 'border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground',
  code: 'bg-muted rounded px-2 py-1 font-mono text-sm',
  link: 'text-primary underline cursor-pointer hover:text-primary/80',
};

export function ManuscriptEditor({
  bookId,
  chapterId,
  chapterTitle,
  initialContent,
  onContentChange,
  readOnly = false,
}: ManuscriptEditorProps) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);

  const onRef = useCallback((elem: HTMLDivElement | null) => {
    if (elem !== null) {
      setFloatingAnchorElem(elem);
    }
  }, []);

  const initialConfig = {
    namespace: 'CasperManuscriptEditor',
    theme,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      SectionMarkerNode,
    ],
    editable: !readOnly,
    onError: (error: Error) => {
      console.error('Lexical editor error:', error);
    },
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        const wordCount = textContent
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        // Store as JSON for persistence
        const json = JSON.stringify(editorState.toJSON());
        onContentChange?.(json, wordCount);
      });
    },
    [onContentChange]
  );

  return (
    <div className="h-full flex flex-col bg-background rounded-lg border">
      <LexicalComposer initialConfig={initialConfig}>
        {/* Toolbar */}
        {!readOnly && <ToolbarPlugin />}

        {/* Editor content area */}
        <div className="flex-1 relative overflow-auto" ref={onRef}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none px-8 py-6 min-h-full prose-editor"
                style={{ minHeight: '500px' }}
              />
            }
            placeholder={
              <div className="absolute top-6 left-8 text-muted-foreground pointer-events-none">
                {chapterTitle
                  ? `Start writing "${chapterTitle}"...`
                  : 'Start writing your chapter...'}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          {/* Core plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />

          {/* Content change handler */}
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />

          {/* Initial content loader */}
          {initialContent && <InitialContentPlugin content={initialContent} />}

          {/* Custom plugins */}
          <SectionMarkerPlugin chapterId={chapterId} />
          <AIIntegrationPlugin bookId={bookId} chapterId={chapterId} />
          <AutoSavePlugin bookId={bookId} chapterId={chapterId} delay={2000} />
        </div>
      </LexicalComposer>
    </div>
  );
}
