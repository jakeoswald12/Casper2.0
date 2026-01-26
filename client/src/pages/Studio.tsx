import { useParams, Link } from 'wouter';
import { Ghost, ArrowLeft, FileText, MessageSquare, Upload, Loader2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SourcesManager } from '../components/sources/SourcesManager';

export function Studio() {
  const params = useParams<{ bookId: string }>();
  const bookId = parseInt(params.bookId || '0');

  const { data: book, isLoading, error } = trpc.books.get.useQuery(
    { bookId },
    { enabled: bookId > 0 }
  );

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs defaultValue="sources" className="h-full">
          <TabsList className="mb-6">
            <TabsTrigger value="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Outline
            </TabsTrigger>
            <TabsTrigger value="write" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Write
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Upload className="w-4 h-4" />
              Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outline" className="mt-0">
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Outline Editor</h3>
              <p>Build your book structure with AI assistance.</p>
              <p className="text-sm mt-2">Coming in Phase 2: Lexical Editor</p>
            </div>
          </TabsContent>

          <TabsContent value="write" className="mt-0">
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Writing Studio</h3>
              <p>Write your manuscript with Casper's AI assistance.</p>
              <p className="text-sm mt-2">Coming in Phase 2: Chat & Editor</p>
            </div>
          </TabsContent>

          <TabsContent value="sources" className="mt-0">
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
        </Tabs>
      </main>
    </div>
  );
}
