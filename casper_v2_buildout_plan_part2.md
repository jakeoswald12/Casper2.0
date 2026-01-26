# Casper V2 Build-Out: Part 2 - Lexical Editor & Chat System

## Phase 2: Lexical Rich Text Editor (Weeks 3-4)

### 🎯 Goals
- Replace textarea with Lexical editor
- Implement AI integration bridge
- Add line numbering system
- Enable section markers
- Support typewriter effect for streaming

### Installation

```bash
pnpm add lexical @lexical/react @lexical/rich-text @lexical/list @lexical/link \
  @lexical/code @lexical/markdown @lexical/clipboard @lexical/history @lexical/utils \
  @lexical/selection @lexical/text
```

### Base Editor Component

```typescript
// client/src/components/editor/ManuscriptEditor.tsx

import { useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { EditorState } from 'lexical';

// Custom nodes
import { SectionMarkerNode } from './nodes/SectionMarkerNode';
import { LineNumberNode } from './nodes/LineNumberNode';

// Plugins
import { LineNumberPlugin } from './plugins/LineNumberPlugin';
import { SectionMarkerPlugin } from './plugins/SectionMarkerPlugin';
import { AIIntegrationPlugin } from './plugins/AIIntegrationPlugin';
import { AutoSavePlugin } from './plugins/AutoSavePlugin';

interface ManuscriptEditorProps {
  bookId: number;
  chapterId: string;
  initialContent?: string;
  onContentChange?: (content: string, wordCount: number) => void;
}

export function ManuscriptEditor({
  bookId,
  chapterId,
  initialContent,
  onContentChange,
}: ManuscriptEditorProps) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  const initialConfig = {
    namespace: 'CasperEditor',
    theme: {
      heading: {
        h1: 'text-3xl font-bold mt-6 mb-4',
        h2: 'text-2xl font-bold mt-5 mb-3',
        h3: 'text-xl font-semibold mt-4 mb-2',
      },
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
      paragraph: 'mb-2 leading-relaxed',
      list: {
        ul: 'list-disc ml-6 mb-2',
        ol: 'list-decimal ml-6 mb-2',
        listitem: 'mb-1',
      },
      quote: 'border-l-4 border-gray-300 pl-4 italic my-4',
      code: 'bg-gray-100 rounded px-2 py-1 font-mono text-sm',
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      SectionMarkerNode,
      LineNumberNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
  };

  return (
    <div className="relative h-full">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative h-full flex">
          {/* Line numbers gutter */}
          <div className="flex-shrink-0 w-12 bg-muted/30 border-r select-none">
            <LineNumberPlugin />
          </div>

          {/* Editor content */}
          <div className="flex-1 relative overflow-auto" ref={onRef}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="outline-none px-4 py-4 min-h-full" />
              }
              placeholder={
                <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                  Start writing your chapter...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            
            <HistoryPlugin />
            
            <OnChangePlugin
              onChange={(editorState: EditorState) => {
                editorState.read(() => {
                  const text = editorState.toJSON();
                  const plainText = extractPlainText(editorState);
                  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
                  onContentChange?.(JSON.stringify(text), wordCount);
                });
              }}
            />
            
            {/* Custom plugins */}
            <SectionMarkerPlugin chapterId={chapterId} />
            <AIIntegrationPlugin bookId={bookId} chapterId={chapterId} />
            <AutoSavePlugin bookId={bookId} chapterId={chapterId} delay={1000} />
            
            {floatingAnchorElem && (
              <>
                {/* Floating toolbar would go here */}
              </>
            )}
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}

function extractPlainText(editorState: EditorState): string {
  let text = '';
  editorState.read(() => {
    const root = editorState._nodeMap;
    root.forEach((node: any) => {
      if (node.getTextContent) {
        text += node.getTextContent() + ' ';
      }
    });
  });
  return text;
}
```

### Custom Section Marker Node

```typescript
// client/src/components/editor/nodes/SectionMarkerNode.ts

import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

export type SerializedSectionMarkerNode = Spread<
  {
    sectionId: string;
    sectionTitle: string;
  },
  SerializedLexicalNode
>;

export class SectionMarkerNode extends DecoratorNode<JSX.Element> {
  __sectionId: string;
  __sectionTitle: string;

  static getType(): string {
    return 'section-marker';
  }

  static clone(node: SectionMarkerNode): SectionMarkerNode {
    return new SectionMarkerNode(node.__sectionId, node.__sectionTitle, node.__key);
  }

  constructor(sectionId: string, sectionTitle: string, key?: NodeKey) {
    super(key);
    this.__sectionId = sectionId;
    this.__sectionTitle = sectionTitle;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section-marker';
    div.setAttribute('data-section-id', this.__sectionId);
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedSectionMarkerNode): SectionMarkerNode {
    return new SectionMarkerNode(serializedNode.sectionId, serializedNode.sectionTitle);
  }

  exportJSON(): SerializedSectionMarkerNode {
    return {
      type: 'section-marker',
      version: 1,
      sectionId: this.__sectionId,
      sectionTitle: this.__sectionTitle,
    };
  }

  decorate(): JSX.Element {
    return (
      <div
        className="flex items-center gap-2 py-2 px-3 my-4 bg-muted/50 rounded border-l-4 border-primary"
        data-section-id={this.__sectionId}
      >
        <span className="text-xs font-mono text-muted-foreground">
          #{this.__sectionId}
        </span>
        <span className="text-sm font-medium">{this.__sectionTitle}</span>
      </div>
    );
  }

  getSectionId(): string {
    return this.__sectionId;
  }

  getSectionTitle(): string {
    return this.__sectionTitle;
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
```

### AI Integration Plugin

```typescript
// client/src/components/editor/plugins/AIIntegrationPlugin.tsx

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $createParagraphNode, $createTextNode } from 'lexical';
import { $createSectionMarkerNode, $isSectionMarkerNode } from '../nodes/SectionMarkerNode';

interface AIIntegrationPluginProps {
  bookId: number;
  chapterId: string;
}

export function AIIntegrationPlugin({ bookId, chapterId }: AIIntegrationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const aiStreamingRef = useRef(false);

  useEffect(() => {
    // Register global handler for AI content insertion
    (window as any).__insertAIContent = async (
      content: string,
      targetSection?: string,
      targetLine?: number,
      streaming = true
    ) => {
      if (streaming) {
        await insertContentWithTypewriter(content, targetSection, targetLine);
      } else {
        await insertContentInstantly(content, targetSection, targetLine);
      }
    };

    return () => {
      delete (window as any).__insertAIContent;
    };
  }, [editor]);

  async function insertContentWithTypewriter(
    content: string,
    targetSection?: string,
    targetLine?: number
  ) {
    aiStreamingRef.current = true;

    editor.update(() => {
      const root = $getRoot();
      
      // Find target position
      let targetNode = null;
      
      if (targetSection) {
        // Find section marker
        const children = root.getChildren();
        for (const child of children) {
          if ($isSectionMarkerNode(child) && child.getSectionId() === targetSection) {
            targetNode = child;
            break;
          }
        }
      }

      if (!targetNode) {
        // Insert at cursor or end
        const selection = $getSelection();
        if (selection) {
          targetNode = selection.getNodes()[0];
        } else {
          targetNode = root.getLastChild();
        }
      }

      // Create paragraph for new content
      const paragraph = $createParagraphNode();
      const textNode = $createTextNode('');
      paragraph.append(textNode);

      if (targetNode) {
        targetNode.insertAfter(paragraph);
      } else {
        root.append(paragraph);
      }

      // Typewriter effect
      let index = 0;
      const interval = setInterval(() => {
        if (index >= content.length) {
          clearInterval(interval);
          aiStreamingRef.current = false;
          return;
        }

        const char = content[index];
        editor.update(() => {
          textNode.setTextContent(textNode.getTextContent() + char);
        });

        index++;
      }, 20); // 20ms per character = 50 chars/second
    });
  }

  async function insertContentInstantly(
    content: string,
    targetSection?: string,
    targetLine?: number
  ) {
    editor.update(() => {
      const root = $getRoot();
      
      // Find target position (same logic as typewriter)
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
        if (selection) {
          targetNode = selection.getNodes()[0];
        } else {
          targetNode = root.getLastChild();
        }
      }

      // Split content into paragraphs
      const paragraphs = content.split('\n\n');
      
      paragraphs.forEach((paragraphText) => {
        if (paragraphText.trim()) {
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode(paragraphText);
          paragraph.append(textNode);
          
          if (targetNode) {
            targetNode.insertAfter(paragraph);
            targetNode = paragraph; // Continue inserting after previous paragraph
          } else {
            root.append(paragraph);
          }
        }
      });
    });
  }

  return null;
}
```

### Line Number Plugin

```typescript
// client/src/components/editor/plugins/LineNumberPlugin.tsx

import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';

export function LineNumberPlugin() {
  const [editor] = useLexicalComposerContext();
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        const lines = text.split('\n').length;
        setLineCount(lines);
      });
    });
  }, [editor]);

  return (
    <div className="py-4 px-2 text-xs text-muted-foreground font-mono">
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i} className="text-right leading-relaxed h-6">
          {i + 1}
        </div>
      ))}
    </div>
  );
}
```

### Auto-Save Plugin

```typescript
// client/src/components/editor/plugins/AutoSavePlugin.tsx

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorState } from 'lexical';
import { trpc } from '@/lib/trpc';

interface AutoSavePluginProps {
  bookId: number;
  chapterId: string;
  delay?: number;
}

export function AutoSavePlugin({ bookId, chapterId, delay = 1000 }: AutoSavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const updateManuscript = trpc.books.updateManuscript.useMutation();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const content = JSON.stringify(editorState.toJSON());
        const plainText = extractPlainText(editorState);
        const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;

        updateManuscript.mutate({
          bookId,
          chapterId,
          content,
          wordCount,
        });
      }, delay);
    });
  }, [editor, bookId, chapterId, delay]);

  return null;
}

function extractPlainText(editorState: EditorState): string {
  let text = '';
  editorState.read(() => {
    text = editorState._nodeMap
      .values()
      .map((node: any) => node.getTextContent?.() || '')
      .join(' ');
  });
  return text;
}
```

---

## Phase 3: Chat Persistence & Enhancement (Week 5)

### 🎯 Goals
- Save all chat messages to database
- Implement chat sessions
- Add message starring
- Include starred messages in RAG
- Build session management UI

### Backend: Chat Procedures

```typescript
// server/routers.ts - Add chat procedures

chat: {
  // Create new chat session
  createSession: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      title: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await ctx.db.insert(chatSessions).values({
        bookId: input.bookId,
        userId: ctx.userId,
        title: input.title || 'New Chat',
        isActive: true,
      }).returning();
      
      return session[0];
    }),
    
  // Get sessions for a book
  getSessions: protectedProcedure
    .input(z.object({
      bookId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.chatSessions.findMany({
        where: and(
          eq(chatSessions.bookId, input.bookId),
          eq(chatSessions.userId, ctx.userId)
        ),
        orderBy: [desc(chatSessions.lastMessageAt)],
      });
    }),
    
  // Get messages for a session
  getMessages: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.sessionId, input.sessionId),
          eq(chatMessages.userId, ctx.userId)
        ),
        orderBy: [desc(chatMessages.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
      
      return messages.reverse(); // Oldest first
    }),
    
  // Save message
  saveMessage: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      bookId: z.number(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const message = await ctx.db.insert(chatMessages).values({
        sessionId: input.sessionId,
        bookId: input.bookId,
        userId: ctx.userId,
        role: input.role,
        content: input.content,
        metadata: input.metadata,
        isStarred: false,
      }).returning();
      
      // Update session's last message time
      await ctx.db.update(chatSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatSessions.id, input.sessionId));
      
      return message[0];
    }),
    
  // Toggle message star
  toggleStar: protectedProcedure
    .input(z.object({
      messageId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const message = await ctx.db.query.chatMessages.findFirst({
        where: and(
          eq(chatMessages.id, input.messageId),
          eq(chatMessages.userId, ctx.userId)
        ),
      });
      
      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Message not found',
        });
      }
      
      await ctx.db.update(chatMessages)
        .set({ isStarred: !message.isStarred })
        .where(eq(chatMessages.id, input.messageId));
      
      return { isStarred: !message.isStarred };
    }),
    
  // Delete session
  deleteSession: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(chatSessions)
        .where(and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, ctx.userId)
        ));
      
      return { success: true };
    }),
    
  // Rename session
  renameSession: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      title: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.update(chatSessions)
        .set({ title: input.title })
        .where(and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, ctx.userId)
        ));
      
      return { success: true };
    }),
},
```

### Frontend: Enhanced Chat Component

```typescript
// client/src/components/chat/ChatPanel.tsx

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Star, Send, Loader2, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChatPanelProps {
  bookId: number;
  currentSessionId?: number;
  onSessionChange?: (sessionId: number) => void;
}

export function ChatPanel({ bookId, currentSessionId, onSessionChange }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const utils = trpc.useUtils();
  
  // Get current session or create one
  const { data: sessions } = trpc.chat.getSessions.useQuery({ bookId });
  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (session) => {
      onSessionChange?.(session.id);
      utils.chat.getSessions.invalidate({ bookId });
    },
  });
  
  const sessionId = currentSessionId || sessions?.[0]?.id;
  
  // Get messages
  const { data: messages, isLoading } = trpc.chat.getMessages.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );
  
  const saveMessage = trpc.chat.saveMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ sessionId: sessionId! });
    },
  });
  
  const toggleStar = trpc.chat.toggleStar.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ sessionId: sessionId! });
    },
  });
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !sessionId) return;
    
    const userMessage = message.trim();
    setMessage('');
    setIsStreaming(true);
    
    // Save user message
    await saveMessage.mutateAsync({
      sessionId,
      bookId,
      role: 'user',
      content: userMessage,
    });
    
    try {
      // Call agent with streaming
      const response = await fetch('/api/trpc/outline.processCommand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: userMessage,
          bookId,
          sessionId,
        }),
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'message') {
              assistantMessage += data.content;
            }
          }
        }
      }
      
      // Save assistant message
      await saveMessage.mutateAsync({
        sessionId,
        bookId,
        role: 'assistant',
        content: assistantMessage,
      });
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsStreaming(false);
    }
  };
  
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={() => createSession.mutate({ bookId })}>
          Start New Chat
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => (
              <Card
                key={msg.id}
                className={`p-4 ${
                  msg.role === 'user'
                    ? 'ml-12 bg-primary/5'
                    : 'mr-12 bg-muted/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {msg.role === 'user' ? 'You' : 'Casper'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStar.mutate({ messageId: msg.id })}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        msg.isStarred ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                  </Button>
                </div>
              </Card>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>Start a conversation with Casper!</p>
          </div>
        )}
        
        {isStreaming && (
          <Card className="mr-12 bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Casper is thinking...</span>
            </div>
          </Card>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask Casper anything..."
            className="flex-1 min-h-[60px] max-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={!message.trim() || isStreaming}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
```

**[DOCUMENT CONTINUES...]**

Should I continue with Phase 4 (Summary Editor), Phase 5 (Export System), and the remaining phases?
