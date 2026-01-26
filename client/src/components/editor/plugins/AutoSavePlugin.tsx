import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { trpc } from '../../../lib/trpc';

interface AutoSavePluginProps {
  bookId: number;
  chapterId: string;
  delay?: number;
}

export function AutoSavePlugin({
  bookId,
  chapterId,
  delay = 2000,
}: AutoSavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  const updateManuscript = trpc.books.updateManuscript.useMutation({
    onError: (error) => {
      console.error('Auto-save failed:', error);
    },
  });

  useEffect(() => {
    const removeListener = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        // Only save if there are actual changes
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }

        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Debounce the save
        timeoutRef.current = setTimeout(() => {
          editorState.read(() => {
            const root = $getRoot();
            const textContent = root.getTextContent();
            const wordCount = textContent
              .split(/\s+/)
              .filter((w) => w.length > 0).length;

            const content = JSON.stringify(editorState.toJSON());

            // Only save if content has changed
            if (content !== lastSavedRef.current) {
              lastSavedRef.current = content;

              updateManuscript.mutate({
                bookId,
                chapterId,
                content,
                wordCount,
              });
            }
          });
        }, delay);
      }
    );

    return () => {
      removeListener();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [editor, bookId, chapterId, delay, updateManuscript]);

  return null;
}
