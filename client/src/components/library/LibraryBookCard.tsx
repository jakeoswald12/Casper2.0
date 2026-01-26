import { Link } from 'wouter';
import { BookOpen, Eye, Calendar } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { format } from 'date-fns';

interface LibraryBook {
  id: number;
  title: string;
  author: string;
  description: string | null;
  coverImage: string | null;
  genre: string | null;
  viewCount: number | null;
  publishedAt: Date;
}

interface LibraryBookCardProps {
  book: LibraryBook;
}

export function LibraryBookCard({ book }: LibraryBookCardProps) {
  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        {/* Cover Image Placeholder */}
        <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 rounded-md mb-3 flex items-center justify-center">
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="w-full h-full object-cover rounded-md"
            />
          ) : (
            <BookOpen className="w-12 h-12 text-primary/40" />
          )}
        </div>
        <h3 className="font-semibold text-lg line-clamp-2">{book.title}</h3>
        <p className="text-sm text-muted-foreground">by {book.author}</p>
      </CardHeader>

      <CardContent className="flex-1">
        {book.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {book.description}
          </p>
        )}
        {book.genre && (
          <span className="inline-block mt-2 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
            {book.genre}
          </span>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {(book.viewCount || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(book.publishedAt), 'MMM d, yyyy')}
          </span>
        </div>
        <Link href={`/library/${book.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
