import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '../../lib/trpc';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Star,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

interface ChatPanelProps {
  bookId: number;
  onContentGenerated?: (content: string) => void;
}

export function ChatPanel({ bookId, onContentGenerated }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: sessions, isLoading: sessionsLoading } = trpc.chat.getSessions.useQuery({
    bookId,
  });

  const { data: messages, isLoading: messagesLoading } = trpc.chat.getMessages.useQuery(
    { sessionId: activeSessionId! },
    { enabled: !!activeSessionId }
  );

  // Mutations
  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (session) => {
      setActiveSessionId(session.id);
      utils.chat.getSessions.invalidate({ bookId });
    },
  });

  const saveMessage = trpc.chat.saveMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ sessionId: activeSessionId! });
    },
  });

  const toggleStar = trpc.chat.toggleStar.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ sessionId: activeSessionId! });
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => {
      utils.chat.getSessions.invalidate({ bookId });
      if (sessions && sessions.length > 1) {
        const remainingSessions = sessions.filter((s) => s.id !== activeSessionId);
        setActiveSessionId(remainingSessions[0]?.id || null);
      } else {
        setActiveSessionId(null);
      }
    },
  });

  const renameSession = trpc.chat.renameSession.useMutation({
    onSuccess: () => {
      utils.chat.getSessions.invalidate({ bookId });
      setEditingSessionId(null);
    },
  });

  // Auto-select first session
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!message.trim() || !activeSessionId || isStreaming) return;

      const userMessage = message.trim();
      setMessage('');
      setIsStreaming(true);
      setStreamingContent('');

      // Save user message
      await saveMessage.mutateAsync({
        sessionId: activeSessionId,
        bookId,
        role: 'user',
        content: userMessage,
      });

      try {
        // Call the chat API with streaming
        const token = localStorage.getItem('token');
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: userMessage,
            bookId,
            sessionId: activeSessionId,
          }),
        });

        if (!response.ok) {
          throw new Error('Chat request failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'content') {
                    fullContent += data.content;
                    setStreamingContent(fullContent);
                  } else if (data.type === 'tool_use' && data.content) {
                    // Handle content from tool calls
                    onContentGenerated?.(data.content);
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        // Save assistant message
        if (fullContent) {
          await saveMessage.mutateAsync({
            sessionId: activeSessionId,
            bookId,
            role: 'assistant',
            content: fullContent,
          });
        }
      } catch (error) {
        console.error('Chat error:', error);
        // Save error message
        await saveMessage.mutateAsync({
          sessionId: activeSessionId,
          bookId,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        });
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
      }
    },
    [message, activeSessionId, isStreaming, bookId, saveMessage, onContentGenerated]
  );

  const handleNewSession = () => {
    createSession.mutate({ bookId, title: 'New Chat' });
  };

  const handleDeleteSession = (sessionId: number) => {
    if (confirm('Delete this chat session?')) {
      deleteSession.mutate({ sessionId });
    }
  };

  const handleStartRename = (sessionId: number, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle || 'New Chat');
  };

  const handleSaveRename = () => {
    if (editingSessionId && editingTitle.trim()) {
      renameSession.mutate({
        sessionId: editingSessionId,
        title: editingTitle.trim(),
      });
    }
  };

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <Button onClick={handleNewSession} className="w-full gap-2" size="sm">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                    activeSessionId === session.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-1 py-0.5 text-sm bg-background border rounded"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveRename();
                          }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">
                          {session.title || 'New Chat'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.lastMessageAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </>
                    )}
                  </div>
                  {editingSessionId !== session.id && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(session.id, session.title || '');
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No chat sessions yet
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {activeSessionId ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : messages && messages.length > 0 ? (
                <>
                  {messages.map((msg) => (
                    <Card
                      key={msg.id}
                      className={cn(
                        'p-4',
                        msg.role === 'user'
                          ? 'ml-12 bg-primary/5 border-primary/20'
                          : 'mr-12 bg-muted/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold">
                              {msg.role === 'user' ? 'You' : 'Casper'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => toggleStar.mutate({ messageId: msg.id })}
                          title={msg.isStarred ? 'Unstar message' : 'Star message'}
                        >
                          <Star
                            className={cn(
                              'w-4 h-4',
                              msg.isStarred
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            )}
                          />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask Casper to help you write, outline chapters, develop characters,
                    or brainstorm ideas for your book.
                  </p>
                </div>
              )}

              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <Card className="mr-12 bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold">Casper</span>
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {streamingContent}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Thinking indicator */}
              {isStreaming && !streamingContent && (
                <Card className="mr-12 bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Casper is thinking...
                    </span>
                  </div>
                </Card>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask Casper anything about your book..."
                  className="flex-1 min-h-[44px] max-h-[150px] px-3 py-2 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={isStreaming}
                />
                <Button
                  type="submit"
                  disabled={!message.trim() || isStreaming}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No chat selected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new chat to start talking with Casper
              </p>
              <Button onClick={handleNewSession}>
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
