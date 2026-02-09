import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import type { SummaryItem } from '../../../../shared/types';
import { cn } from '../../lib/utils';

interface SummaryItemComponentProps {
  item: SummaryItem;
  onUpdate: (id: string, updates: Partial<SummaryItem>) => void;
  onDelete: (id: string) => void;
}

export function SummaryItemComponent({
  item,
  onUpdate,
  onDelete,
}: SummaryItemComponentProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(item.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [item.content, isExpanded]);

  const handleSaveTitle = () => {
    if (editedTitle.trim()) {
      onUpdate(item.id, { title: editedTitle.trim() });
    } else {
      setEditedTitle(item.title);
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitleEdit = () => {
    setEditedTitle(item.title);
    setIsEditingTitle(false);
  };

  const handleContentChange = (content: string) => {
    onUpdate(item.id, { content });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${item.title}"?`)) {
      onDelete(item.id);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-shadow',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelTitleEdit();
                    }}
                    onBlur={handleSaveTitle}
                    className="flex-1 px-2 py-1 text-base font-medium bg-background border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleSaveTitle}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleCancelTitleEdit}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 group">
                  <h3 className="text-base font-medium">{item.title}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Content textarea */}
            {isExpanded && (
              <textarea
                ref={textareaRef}
                value={item.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Add details about this section..."
                className="w-full min-h-[80px] px-3 py-2 text-sm bg-muted/30 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
              />
            )}

            {/* Collapsed preview */}
            {!isExpanded && item.content && (
              <p className="text-sm text-muted-foreground truncate">
                {item.content}
              </p>
            )}
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
