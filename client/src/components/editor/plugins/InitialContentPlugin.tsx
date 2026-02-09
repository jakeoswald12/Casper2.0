import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface InitialContentPluginProps {
  content: string;
}

export function InitialContentPlugin({ content }: InitialContentPluginProps) {
  const [editor] = useLexicalComposerContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || !content) return;

    try {
      // Try to parse as JSON (Lexical state)
      const editorState = editor.parseEditorState(content);
      editor.setEditorState(editorState);
      hasInitialized.current = true;
    } catch {
      // If not valid JSON, treat as plain text
      console.warn('Could not parse initial content as Lexical state');
    }
  }, [editor, content]);

  return null;
}
