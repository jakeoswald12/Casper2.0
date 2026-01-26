import { useState, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import {
  Ghost,
  ArrowLeft,
  FileText,
  MessageSquare,
  Upload,
  Loader2,
  PenTool,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SourcesManager } from '../components/sources/SourcesManager';
import { ManuscriptEditor } from '../components/editor/ManuscriptEditor';
import { ChatPanel } from '../components/chat/ChatPanel';
import { SummaryEditor } from '../components/summary/SummaryEditor';
import { ExportButton } from '../components/export/ExportButton';
import { cn } from '../lib/utils';

export function Studio() {
  const params = useParams<{ bookId: string }>();
  const bookId = parseInt(params.bookId || '0');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const { data: book, isLoading, error } = trpc.books.get.useQuery(
    { bookId },
    { enabled: bookId > 0 }
  );

  const { data: outline } = trpc.books.getOutline.useQuery(
    { bookId },
    { enabled: bookId > 0 }
  );

  const { data: manuscript } = trpc.books.getManuscript.useQuery(
    { bookId, chapterId: selectedChapterId! },
    { enabled: bookId > 0 && !!selectedChapterId }
  );

  // Get chapters from outline
  const chapters = outline?.filter((item) => item.type === 'chapter') || [];

  // Auto-select first chapter
  if (!selectedChapterId && chapters.length > 0) {
    setSelectedChapterId(chapters[0].id);
  }

  const handleContentChange = useCallback((content: string, newWordCount: number) => {
    setWordCount(newWordCount);
  }, []);

  const handleContentGenerated = useCallback((content: string) => {
    // Insert AI-generated content into editor
    if ((window as any).__insertAIContent) {
      (window as any).__insertAIContent(content, undefined, true);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Book not found</h1>
        <Link href="/dashboard">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b flex-shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Ghost className="w-6 h-6 text-primary" />
                <span className="font-semibold">{book.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {wordCount.toLocaleString()} words
              </span>
              <ExportButton bookId={bookId} bookTitle={book.title} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        <Tabs defaultValue="write" className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Outline
              </TabsTrigger>
              <TabsTrigger value="write" className="gap-2">
                <PenTool className="w-4 h-4" />
                Write
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2 lg:hidden">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-2">
                <Upload className="w-4 h-4" />
                Sources
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Main content area */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="outline" className="h-full m-0 p-4">
                <div className="h-full border rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <FileText className="w-12 h-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Outline Editor</h3>
                  <p>Build your book structure with AI assistance.</p>
                  <p className="text-sm mt-4 max-w-md">
                    Use the Chat panel to ask Casper to create chapters, add sections,
                    and organize your book outline.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="write" className="h-full m-0 flex overflow-hidden">
                {/* Chapter sidebar */}
                <div className="w-56 border-r flex-shrink-0 overflow-y-auto bg-muted/20">
                  <div className="p-3 border-b">
                    <h3 className="font-medium text-sm">Chapters</h3>
                  </div>
                  {chapters.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {chapters.map((chapter, index) => (
                        <button
                          key={chapter.id}
                          onClick={() => setSelectedChapterId(chapter.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                            selectedChapterId === chapter.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                        >
                          <span className="text-muted-foreground mr-2">
                            {index + 1}.
                          </span>
                          <span className="truncate">{chapter.content}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      <p>No chapters yet.</p>
                      <p className="mt-2">
                        Ask Casper to create your outline!
                      </p>
                    </div>
                  )}
                </div>

                {/* Editor */}
                <div className="flex-1 p-4 overflow-hidden">
                  {selectedChapterId ? (
                    <ManuscriptEditor
                      bookId={bookId}
                      chapterId={selectedChapterId}
                      chapterTitle={selectedChapter?.content}
                      initialContent={manuscript?.content || undefined}
                      onContentChange={handleContentChange}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center border rounded-lg">
                      <div className="text-center text-muted-foreground">
                        <PenTool className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">Select a chapter</h3>
                        <p>Choose a chapter from the sidebar to start writing.</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chat" className="h-full m-0 lg:hidden">
                <ChatPanel
                  bookId={bookId}
                  onContentGenerated={handleContentGenerated}
                />
              </TabsContent>

              <TabsContent value="sources" className="h-full m-0 p-4 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Source Materials</h2>
                    <p className="text-muted-foreground">
                      Upload documents to enhance Casper's knowledge about your book.
                      Supported formats: PDF, DOCX, TXT, EPUB.
                    </p>
                  </div>
                  <SourcesManager bookId={bookId} />
                </div>
              </TabsContent>

              <TabsContent value="summary" className="h-full m-0 p-4 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Book Summary</h2>
                    <p className="text-muted-foreground">
                      Organize your book's summary structure. Drag and drop sections to reorder them.
                    </p>
                  </div>
                  <SummaryEditor bookId={bookId} />
                </div>
              </TabsContent>
            </div>

            {/* Chat sidebar (desktop) */}
            <div
              className={cn(
                'hidden lg:flex flex-col border-l transition-all duration-300',
                chatCollapsed ? 'w-12' : 'w-96'
              )}
            >
              <div className="flex items-center justify-between p-2 border-b">
                {!chatCollapsed && (
                  <span className="text-sm font-medium px-2">Chat with Casper</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatCollapsed(!chatCollapsed)}
                  className="ml-auto"
                >
                  {chatCollapsed ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {!chatCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    bookId={bookId}
                    onContentGenerated={handleContentGenerated}
                  />
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
