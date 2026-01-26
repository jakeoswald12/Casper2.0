import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Download, Loader2, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  bookId: number;
  bookTitle: string;
}

export function ExportButton({ bookId, bookTitle }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const exportDocx = trpc.books.exportDocx.useMutation();

  const handleExportDocx = async () => {
    setIsExporting(true);

    try {
      const result = await exportDocx.mutateAsync({ bookId });

      // Create download link
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export complete!', {
        description: `${result.filename} has been downloaded.`,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportDocx}>
          <FileText className="w-4 h-4 mr-2" />
          Export as DOCX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
