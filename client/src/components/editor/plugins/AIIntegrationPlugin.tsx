import { useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $createParagraphNode,
  $createTextNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
} from 'lexical';
import { $isSectionMarkerNode } from '../nodes/SectionMarkerNode';

interface AIIntegrationPluginProps {
  bookId: number;
  chapterId: string;
}

// Command for AI content insertion
export const INSERT_AI_CONTENT_COMMAND: LexicalCommand<{
  content: string;
  targetSection?: string;
  streaming?: boolean;
}> = createCommand('INSERT_AI_CONTENT_COMMAND');

export function AIIntegrationPlugin({ bookId: _bookId, chapterId: _chapterId }: AIIntegrationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const streamingRef = useRef(false);
  const streamingNodeRef = useRef<any>(null);

  // Insert content with typewriter effect
  const insertWithTypewriter = useCallback(
    async (content: string, targetSection?: string) => {
      if (streamingRef.current) return;
      streamingRef.current = true;

      // Create a new paragraph for the content
      editor.update(() => {
        const root = $getRoot();
        let targetNode = null;

        // Find target section if specified
        if (targetSection) {
          const children = root.getChildren();
          for (const child of children) {
            if ($isSectionMarkerNode(child) && child.getSectionId() === targetSection) {
              targetNode = child;
              break;
            }
          }
        }

        // If no target, use current selection or end of document
        if (!targetNode) {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            targetNode = selection.anchor.getNode();
          } else {
            targetNode = root.getLastChild();
          }
        }

        // Create paragraph with empty text node
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('');
        paragraph.append(textNode);

        if (targetNode) {
          targetNode.insertAfter(paragraph);
        } else {
          root.append(paragraph);
        }

        streamingNodeRef.current = textNode;
      });

      // Typewriter effect - character by character
      const chars = content.split('');
      let index = 0;

      const typeNextChar = () => {
        if (index >= chars.length) {
          streamingRef.current = false;
          streamingNodeRef.current = null;
          return;
        }

        editor.update(() => {
          if (streamingNodeRef.current) {
            const currentText = streamingNodeRef.current.getTextContent();
            streamingNodeRef.current.setTextContent(currentText + chars[index]);
          }
        });

        index++;
        // Variable speed: faster for spaces, slower for punctuation
        const char = chars[index - 1];
        let delay = 15;
        if (char === ' ') delay = 5;
        if (['.', '!', '?'].includes(char)) delay = 50;
        if ([',', ';', ':'].includes(char)) delay = 30;

        setTimeout(typeNextChar, delay);
      };

      typeNextChar();
    },
    [editor]
  );

  // Insert content instantly
  const insertInstantly = useCallback(
    (content: string, targetSection?: string) => {
      editor.update(() => {
        const root = $getRoot();
        let targetNode = null;

        if (targetSection) {
          const children = root.getChildren();
          for (const child of children) {
            if ($isSectionMarkerNode(child) && child.getSectionId() === targetSection) {
              targetNode = child;
              break;
            }
          }
        }

        if (!targetNode) {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            targetNode = selection.anchor.getNode();
          } else {
            targetNode = root.getLastChild();
          }
        }

        // Split content into paragraphs
        const paragraphs = content.split('\n\n').filter((p) => p.trim());

        for (const paragraphText of paragraphs) {
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode(paragraphText.trim());
          paragraph.append(textNode);

          if (targetNode) {
            targetNode.insertAfter(paragraph);
            targetNode = paragraph;
          } else {
            root.append(paragraph);
          }
        }
      });
    },
    [editor]
  );

  useEffect(() => {
    // Register command handler
    const removeListener = editor.registerCommand(
      INSERT_AI_CONTENT_COMMAND,
      (payload) => {
        const { content, targetSection, streaming = true } = payload;

        if (streaming) {
          insertWithTypewriter(content, targetSection);
        } else {
          insertInstantly(content, targetSection);
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return removeListener;
  }, [editor, insertWithTypewriter, insertInstantly]);

  useEffect(() => {
    // Expose global function for AI content insertion
    (window as any).__insertAIContent = (
      content: string,
      targetSection?: string,
      streaming = true
    ) => {
      editor.dispatchCommand(INSERT_AI_CONTENT_COMMAND, {
        content,
        targetSection,
        streaming,
      });
    };

    // Expose function to check if currently streaming
    (window as any).__isAIStreaming = () => streamingRef.current;

    // Expose function to stop streaming
    (window as any).__stopAIStreaming = () => {
      streamingRef.current = false;
    };

    return () => {
      delete (window as any).__insertAIContent;
      delete (window as any).__isAIStreaming;
      delete (window as any).__stopAIStreaming;
    };
  }, [editor]);

  return null;
}
