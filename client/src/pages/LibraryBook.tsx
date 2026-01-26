import { useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  Ghost,
  ArrowLeft,
  BookOpen,
  Eye,
  Calendar,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export function LibraryBook() {
  const params = useParams<{ bookId: string }>();
  const bookId = parseInt(params.bookId || '0');
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [isAddingToProject, setIsAddingToProject] = useState(false);

  const { data: book, isLoading, error } = trpc.library.getBook.useQuery(
    { bookId },
    { enabled: bookId > 0 }
  );

  const { data: myBooks } = trpc.books.list.useQuery();

  const addToProject = trpc.library.addToProject.useMutation({
    onSuccess: (data) => {
      toast.success('Added to project!', {
        description: `${data.chunkCount} text chunks added as source material.`,
      });
      setIsAddingToProject(false);
    },
    onError: (error) => {
      toast.error('Failed to add to project', {
        description: error.message,
      });
    },
  });

  const handleAddToProject = () => {
    if (!selectedBook) return;
    addToProject.mutate({
      libraryBookId: bookId,
      bookId: parseInt(selectedBook),
    });
  };

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
        <Link href="/library">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/library">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Library
                </Button>
              </Link>
            </div>
            <Dialog open={isAddingToProject} onOpenChange={setIsAddingToProject}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add as Source Material</DialogTitle>
                  <DialogDescription>
                    Add this book to one of your projects as reference material.
                    It will be available in the RAG context for AI assistance.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedBook} onValueChange={setSelectedBook}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {myBooks?.map((b) => (
                        <SelectItem key={b.id} value={b.id.toString()}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {myBooks?.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      You don't have any projects yet. Create one first!
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingToProject(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToProject}
                    disabled={!selectedBook || addToProject.isPending}
                  >
                    {addToProject.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Add to Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Book Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                {/* Cover Image */}
                <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-4 flex items-center justify-center">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <BookOpen className="w-16 h-16 text-primary/40" />
                  )}
                </div>
                <CardTitle className="text-2xl">{book.title}</CardTitle>
                <p className="text-lg text-muted-foreground">by {book.author}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {book.description && (
                  <p className="text-muted-foreground">{book.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {book.genre && (
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                      {book.genre}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {(book.viewCount || 0).toLocaleString()} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(book.publishedAt), 'MMM d, yyyy')}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  {book.chapters.length} chapters
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chapters */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Chapters</h2>
            {book.chapters.map((chapter) => (
              <Card key={chapter.id} className="overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedChapter(
                      expandedChapter === chapter.id ? null : chapter.id
                    )
                  }
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <span className="text-muted-foreground mr-2">
                      Chapter {chapter.chapterNumber}
                    </span>
                    <span className="font-medium">{chapter.title}</span>
                    <span className="text-sm text-muted-foreground ml-4">
                      {chapter.wordCount?.toLocaleString() || 0} words
                    </span>
                  </div>
                  {expandedChapter === chapter.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    expandedChapter === chapter.id ? 'max-h-96' : 'max-h-0'
                  )}
                >
                  <div className="p-4 pt-0 border-t">
                    <div className="prose prose-sm max-w-none max-h-64 overflow-y-auto">
                      {chapter.content ? (
                        <p className="whitespace-pre-wrap">
                          {chapter.content.slice(0, 2000)}
                          {chapter.content.length > 2000 && '...'}
                        </p>
                      ) : (
                        <p className="text-muted-foreground italic">
                          No content available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {book.chapters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No chapters available
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
