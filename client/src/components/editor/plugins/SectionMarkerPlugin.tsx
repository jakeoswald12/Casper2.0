import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';
import {
  $createSectionMarkerNode,
  $isSectionMarkerNode,
} from '../nodes/SectionMarkerNode';

interface SectionMarkerPluginProps {
  chapterId: string;
}

// Custom command for inserting section markers
export const INSERT_SECTION_MARKER_COMMAND: LexicalCommand<{
  sectionId: string;
  sectionTitle: string;
}> = createCommand('INSERT_SECTION_MARKER_COMMAND');

export function SectionMarkerPlugin({ chapterId: _chapterId }: SectionMarkerPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command handler for inserting section markers
    const removeCommandListener = editor.registerCommand(
      INSERT_SECTION_MARKER_COMMAND,
      (payload) => {
        const { sectionId, sectionTitle } = payload;

        editor.update(() => {
          const root = $getRoot();
          const selection = root.selectEnd();

          if (selection) {
            const sectionMarker = $createSectionMarkerNode(sectionId, sectionTitle);
            selection.insertNodes([sectionMarker]);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    return () => {
      removeCommandListener();
    };
  }, [editor]);

  useEffect(() => {
    // Expose function to insert section marker from outside
    (window as any).__insertSectionMarker = (
      sectionId: string,
      sectionTitle: string
    ) => {
      editor.dispatchCommand(INSERT_SECTION_MARKER_COMMAND, {
        sectionId,
        sectionTitle,
      });
    };

    // Expose function to get all section markers
    (window as any).__getSectionMarkers = () => {
      let markers: Array<{ id: string; title: string }> = [];

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        const findMarkers = (nodes: any[]) => {
          for (const node of nodes) {
            if ($isSectionMarkerNode(node)) {
              markers.push({
                id: node.getSectionId(),
                title: node.getSectionTitle(),
              });
            }
            if (node.getChildren) {
              findMarkers(node.getChildren());
            }
          }
        };

        findMarkers(children);
      });

      return markers;
    };

    return () => {
      delete (window as any).__insertSectionMarker;
      delete (window as any).__getSectionMarkers;
    };
  }, [editor]);

  return null;
}
