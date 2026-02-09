import { Link } from 'wouter';
import { Ghost, Plus, BookOpen, Clock, Loader2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
  const { data: books, isLoading } = trpc.books.list.useQuery();
  const utils = trpc.useUtils();
  const createBook = trpc.books.create.useMutation({
    onSuccess: () => {
      utils.books.list.invalidate();
    },
  });

  const handleCreateBook = async () => {
    const book = await createBook.mutateAsync({
      title: 'Untitled Book',
    });
    window.location.href = `/studio/${book.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <Ghost className="w-8 h-8 text-primary" />
                <span className="text-xl font-bold">Casper</span>
              </div>
            </Link>
            <Button onClick={handleCreateBook} disabled={createBook.isPending}>
              {createBook.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              New Book
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Books</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <Link key={book.id} href={`/studio/${book.id}`}>
                <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{book.title}</h3>
                      {book.subtitle && (
                        <p className="text-sm text-muted-foreground truncate">
                          {book.subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(new Date(book.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No books yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first book to get started with Casper
            </p>
            <Button onClick={handleCreateBook} disabled={createBook.isPending}>
              {createBook.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Your First Book
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
