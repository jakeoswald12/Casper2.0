# Casper V2 Build-Out: Part 3 - Summary, Export & Settings

## Phase 4: Summary Editor (Week 6)

### 🎯 Goals
- Build hierarchical summary system
- Implement drag-and-drop reordering
- Add default sections
- Support rich text content
- Auto-save functionality

### Backend: Summary Storage

The summary is stored as JSONB in the `books` table (`summaryStructure` field).

```typescript
// Shared type definition
export interface SummaryItem {
  id: string;
  type: 'section' | 'item';
  title: string;
  content: string;
  children?: SummaryItem[];
  position: number;
}

// Default summary structure
export const DEFAULT_SUMMARY: SummaryItem[] = [
  {
    id: 'overview',
    type: 'section',
    title: 'Overview',
    content: '',
    position: 0,
    children: [],
  },
  {
    id: 'audience',
    type: 'section',
    title: 'Target Audience',
    content: '',
    position: 1,
    children: [],
  },
  {
    id: 'tone',
    type: 'section',
    title: 'Tone & Style',
    content: '',
    position: 2,
    children: [],
  },
  {
    id: 'context',
    type: 'section',
    title: 'Context & Setting',
    content: '',
    position: 3,
    children: [],
  },
  {
    id: 'characters',
    type: 'section',
    title: 'Characters',
    content: '',
    position: 4,
    children: [],
  },
];
```

```typescript
// server/routers.ts - Add summary procedures

books: {
  // ... existing book procedures ...
  
  // Get summary structure
  getSummary: protectedProcedure
    .input(z.object({
      bookId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const book = await ctx.db.query.books.findFirst({
        where: and(
          eq(books.id, input.bookId),
          eq(books.userId, ctx.userId)
        ),
      });
      
      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }
      
      return (book.summaryStructure as SummaryItem[]) || DEFAULT_SUMMARY;
    }),
    
  // Update summary structure
  updateSummary: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      summaryStructure: z.any(), // SummaryItem[]
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.update(books)
        .set({ 
          summaryStructure: input.summaryStructure,
          updatedAt: new Date(),
        })
        .where(and(
          eq(books.id, input.bookId),
          eq(books.userId, ctx.userId)
        ));
      
      return { success: true };
    }),
},
```

### Frontend: Summary Editor Component

```typescript
// client/src/components/summary/SummaryEditor.tsx

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
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
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import type { SummaryItem } from '@/types';

interface SummaryEditorProps {
  bookId: number;
}

export function SummaryEditor({ bookId }: SummaryEditorProps) {
  const { data: summaryStructure, isLoading } = trpc.books.getSummary.useQuery({ bookId });
  const [items, setItems] = useState<SummaryItem[]>([]);
  
  const utils = trpc.useUtils();
  const updateSummary = trpc.books.updateSummary.useMutation({
    onSuccess: () => {
      utils.books.getSummary.invalidate({ bookId });
    },
  });
  
  // Update local state when data loads
  useEffect(() => {
    if (summaryStructure) {
      setItems(summaryStructure);
    }
  }, [summaryStructure]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update positions
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          position: index,
        }));
        
        // Save to backend
        updateSummary.mutate({
          bookId,
          summaryStructure: updatedItems,
        });
        
        return updatedItems;
      });
    }
  };
  
  const addSection = () => {
    const newSection: SummaryItem = {
      id: `section-${Date.now()}`,
      type: 'section',
      title: 'New Section',
      content: '',
      position: items.length,
      children: [],
    };
    
    const newItems = [...items, newSection];
    setItems(newItems);
    updateSummary.mutate({
      bookId,
      summaryStructure: newItems,
    });
  };
  
  const updateItem = (id: string, updates: Partial<SummaryItem>) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    
    setItems(newItems);
    
    // Debounced save
    updateSummary.mutate({
      bookId,
      summaryStructure: newItems,
    });
  };
  
  const deleteItem = (id: string) => {
    const newItems = items.filter((item) => item.id !== id);
    setItems(newItems);
    updateSummary.mutate({
      bookId,
      summaryStructure: newItems,
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Book Summary</h2>
        <Button onClick={addSection} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </Button>
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
          <div className="space-y-2">
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
    </div>
  );
}
```

```typescript
// client/src/components/summary/SummaryItemComponent.tsx

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { SummaryItem } from '@/types';

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
  const [isEditing, setIsEditing] = useState(false);
  
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
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <Card ref={setNodeRef} style={style} className="p-4">
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        
        {/* Expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        
        {/* Content */}
        <div className="flex-1 space-y-2">
          {isEditing ? (
            <Input
              value={item.title}
              onChange={(e) => onUpdate(item.id, { title: e.target.value })}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
              }}
              autoFocus
              className="font-medium"
            />
          ) : (
            <h3
              className="font-medium cursor-pointer hover:text-primary"
              onClick={() => setIsEditing(true)}
            >
              {item.title}
            </h3>
          )}
          
          {isExpanded && (
            <Textarea
              value={item.content}
              onChange={(e) => onUpdate(item.id, { content: e.target.value })}
              placeholder="Add details..."
              className="min-h-[100px]"
            />
          )}
        </div>
        
        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
```

---

## Phase 5: Export System (Week 7)

### 🎯 Goals
- Generate professional DOCX files
- Support proper heading hierarchy
- Include metadata and formatting
- Add export button to UI

### Installation

```bash
pnpm add docx
```

### Backend: DOCX Export

```typescript
// server/lib/docxExport.ts

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from 'docx';
import type { Book, OutlineItem, Manuscript } from '../../drizzle/schema';

export async function generateDocx(
  book: Book,
  outlineItems: OutlineItem[],
  manuscripts: Manuscript[]
): Promise<Buffer> {
  const sections = [];
  
  // Title page
  sections.push(
    new Paragraph({
      text: book.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );
  
  if (book.subtitle) {
    sections.push(
      new Paragraph({
        text: book.subtitle,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  }
  
  sections.push(new Paragraph({ text: '', pageBreakBefore: true }));
  
  // Build hierarchical outline
  const outline = buildOutlineTree(outlineItems);
  
  // Generate content for each chapter
  for (const part of outline) {
    if (part.type === 'part') {
      // Part heading
      sections.push(
        new Paragraph({
          text: part.content,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );
    }
    
    for (const chapter of part.children || []) {
      if (chapter.type === 'chapter') {
        // Chapter heading
        sections.push(
          new Paragraph({
            text: chapter.content,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );
        
        // Chapter content
        const manuscript = manuscripts.find(m => m.chapterId === chapter.id);
        if (manuscript && manuscript.content) {
          const paragraphs = parseManuscriptContent(manuscript.content);
          sections.push(...paragraphs);
        }
      }
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // US Letter: 8.5 inches
              height: 15840, // 11 inches
            },
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: sections,
      },
    ],
  });
  
  return await Packer.toBuffer(doc);
}

function buildOutlineTree(items: OutlineItem[]): OutlineItem[] {
  const itemMap = new Map<string, OutlineItem & { children: OutlineItem[] }>();
  const roots: OutlineItem[] = [];
  
  // Create map with children arrays
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });
  
  // Build tree
  items.forEach(item => {
    const node = itemMap.get(item.id)!;
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });
  
  // Sort by position
  const sortByPosition = (a: OutlineItem, b: OutlineItem) => a.position - b.position;
  roots.sort(sortByPosition);
  roots.forEach(root => {
    if ((root as any).children) {
      (root as any).children.sort(sortByPosition);
    }
  });
  
  return roots;
}

function parseManuscriptContent(content: string): Paragraph[] {
  // Parse Lexical JSON or plain text
  let text = content;
  
  try {
    const json = JSON.parse(content);
    // Extract text from Lexical JSON structure
    text = extractTextFromLexical(json);
  } catch {
    // Already plain text
  }
  
  // Split into paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  return paragraphs.map(
    p =>
      new Paragraph({
        children: [new TextRun(p.trim())],
        spacing: { after: 200 },
      })
  );
}

function extractTextFromLexical(json: any): string {
  // Simplified Lexical JSON parser
  let text = '';
  
  if (json.root && json.root.children) {
    json.root.children.forEach((node: any) => {
      if (node.type === 'paragraph' && node.children) {
        const paragraphText = node.children
          .map((child: any) => child.text || '')
          .join('');
        text += paragraphText + '\n\n';
      }
    });
  }
  
  return text.trim();
}
```

### Backend: Export Endpoint

```typescript
// server/routers.ts

books: {
  // ... existing procedures ...
  
  exportDocx: protectedProcedure
    .input(z.object({
      bookId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get book
      const book = await ctx.db.query.books.findFirst({
        where: and(
          eq(books.id, input.bookId),
          eq(books.userId, ctx.userId)
        ),
      });
      
      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }
      
      // Get outline
      const outline = await ctx.db.query.outlineItems.findMany({
        where: eq(outlineItems.bookId, input.bookId),
        orderBy: [asc(outlineItems.position)],
      });
      
      // Get manuscripts
      const manuscripts = await ctx.db.query.manuscripts.findMany({
        where: eq(manuscripts.bookId, input.bookId),
      });
      
      // Generate DOCX
      const buffer = await generateDocx(book, outline, manuscripts);
      
      // Upload to S3 for download
      const filename = `${book.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;
      const s3Key = `exports/${ctx.userId}/${filename}`;
      
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: s3Key,
          Body: buffer,
          ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
      
      // Generate presigned URL (valid for 1 hour)
      const downloadUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: s3Key,
        }),
        { expiresIn: 3600 }
      );
      
      return {
        downloadUrl,
        filename,
      };
    }),
},
```

### Frontend: Export Button

```typescript
// client/src/components/export/ExportButton.tsx

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  bookId: number;
}

export function ExportButton({ bookId }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const exportDocx = trpc.books.exportDocx.useMutation();
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const result = await exportDocx.mutateAsync({ bookId });
      
      // Download file
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export complete!', {
        description: 'Your manuscript has been downloaded.',
        icon: <CheckCircle className="w-4 h-4" />,
      });
    } catch (error: any) {
      toast.error('Export failed', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Export DOCX
        </>
      )}
    </Button>
  );
}
```

---

## Phase 6: Settings & Configuration (Week 8)

### 🎯 Goals
- Build settings page layout
- Add account settings
- Interface preferences
- AI configuration

### Database: User Profiles

```typescript
// drizzle/schema.ts - Add profiles table

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id).unique(),
  bio: text('bio'),
  penName: text('penName'),
  profilePicture: text('profilePicture'),
  
  // Interface settings
  theme: varchar('theme', { length: 20 }).default('system'),
  fontSize: varchar('fontSize', { length: 20 }).default('medium'),
  editorMode: varchar('editorMode', { length: 20 }).default('rich'),
  autoSaveInterval: integer('autoSaveInterval').default(1000),
  
  // AI settings
  anthropicApiKey: text('anthropicApiKey'),
  modelPreference: varchar('modelPreference', { length: 50 }).default('claude-sonnet-4-5'),
  temperature: integer('temperature').default(7), // 0-10 scale
  maxTokens: integer('maxTokens').default(4096),
  extendedThinking: boolean('extendedThinking').default(false),
  
  // Notification settings
  emailNotifications: boolean('emailNotifications').default(true),
  exportNotifications: boolean('exportNotifications').default(true),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
```

### Frontend: Settings Page

```typescript
// client/src/pages/Settings.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { InterfaceSettings } from '@/components/settings/InterfaceSettings';
import { AISettings } from '@/components/settings/AISettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

export function SettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
        
        <TabsContent value="interface">
          <InterfaceSettings />
        </TabsContent>
        
        <TabsContent value="ai">
          <AISettings />
        </TabsContent>
        
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

```typescript
// client/src/components/settings/InterfaceSettings.tsx

import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

export function InterfaceSettings() {
  const { data: profile } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();
  
  const handleUpdate = (updates: Partial<Profile>) => {
    updateProfile.mutate(updates);
  };
  
  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <Label>Theme</Label>
        <Select
          value={profile?.theme || 'system'}
          onValueChange={(theme) => handleUpdate({ theme })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Font Size</Label>
        <Select
          value={profile?.fontSize || 'medium'}
          onValueChange={(fontSize) => handleUpdate({ fontSize })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Editor Mode</Label>
        <Select
          value={profile?.editorMode || 'rich'}
          onValueChange={(editorMode) => handleUpdate({ editorMode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rich">Rich Text</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Auto-save Interval (ms)</Label>
        <Slider
          value={[profile?.autoSaveInterval || 1000]}
          onValueChange={([autoSaveInterval]) => handleUpdate({ autoSaveInterval })}
          min={500}
          max={5000}
          step={500}
        />
        <p className="text-sm text-muted-foreground">
          {profile?.autoSaveInterval || 1000}ms
        </p>
      </div>
    </Card>
  );
}
```

---

**[Week 9: Testing & Polish, and Phases 7-10 to follow...]**

Should I continue with the final phases (Library System, Stripe Integration, Advanced Features, and Deployment)?
