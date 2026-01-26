import { useState, useEffect, useCallback } from 'react';
import { trpc } from '../../lib/trpc';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SummaryItemComponent } from './SummaryItemComponent';
import { Button } from '../ui/button';
import { Plus, Loader2, Save } from 'lucide-react';
import type { SummaryItem } from '../../../../shared/types';
import { toast } from 'sonner';

interface SummaryEditorProps {
  bookId: number;
}

export function SummaryEditor({ bookId }: SummaryEditorProps) {
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: summaryStructure, isLoading } = trpc.books.getSummary.useQuery({
    bookId,
  });

  const utils = trpc.useUtils();
  const updateSummary = trpc.books.updateSummary.useMutation({
    onSuccess: () => {
      utils.books.getSummary.invalidate({ bookId });
      setHasChanges(false);
      toast.success('Summary saved');
    },
    onError: (error) => {
      toast.error('Failed to save summary', {
        description: error.message,
      });
    },
  });

  // Update local state when data loads
  useEffect(() => {
    if (summaryStructure) {
      setItems(summaryStructure);
    }
  }, [summaryStructure]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update positions
        return newItems.map((item, index) => ({
          ...item,
          position: index,
        }));
      });
      setHasChanges(true);
    }
  }, []);

  const addSection = useCallback(() => {
    const newSection: SummaryItem = {
      id: `section-${Date.now()}`,
      type: 'section',
      title: 'New Section',
      content: '',
      position: items.length,
      children: [],
    };

    setItems((prev) => [...prev, newSection]);
    setHasChanges(true);
  }, [items.length]);

  const updateItem = useCallback((id: string, updates: Partial<SummaryItem>) => {
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setHasChanges(true);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((items) => items.filter((item) => item.id !== id));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateSummary.mutate({
      bookId,
      summaryStructure: items,
    });
  }, [bookId, items, updateSummary]);

  // Auto-save after 3 seconds of inactivity
  useEffect(() => {
    if (!hasChanges) return;

    const timeout = setTimeout(() => {
      handleSave();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [items, hasChanges, handleSave]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Book Summary</h2>
          <p className="text-sm text-muted-foreground">
            Define your book's key details for Casper to reference
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <Button onClick={handleSave} size="sm" disabled={!hasChanges || updateSummary.isPending}>
            {updateSummary.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
          <Button onClick={addSection} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((item) => (
              <SummaryItemComponent
                key={item.id}
                item={item}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">No summary sections yet</p>
          <Button onClick={addSection} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Section
          </Button>
        </div>
      )}
    </div>
  );
}
