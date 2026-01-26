import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { trpc } from '../../lib/trpc';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Card } from '../ui/card';
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { formatBytes } from '../../lib/utils';
import { toast } from 'sonner';

interface SourcesManagerProps {
  bookId: number;
}

export function SourcesManager({ bookId }: SourcesManagerProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.files.list.useQuery({ bookId });
  const getUploadUrl = trpc.files.getUploadUrl.useMutation();
  const startProcessing = trpc.files.startProcessing.useMutation();
  const toggleActivation = trpc.files.toggleActivation.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({ bookId });
    },
  });
  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate({ bookId });
      toast.success('Source deleted');
    },
  });

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      try {
        // Get presigned URL
        const { uploadUrl, sourceMaterialId } = await getUploadUrl.mutateAsync({
          bookId,
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        // Upload to S3
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress((prev) => ({ ...prev, [fileId]: progress }));
          }
        });

        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Start processing
        await startProcessing.mutateAsync({ sourceMaterialId });

        // Refresh list
        utils.files.list.invalidate({ bookId });

        toast.success(`${file.name} uploaded and processing started`);

        // Remove from progress
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'text/plain': ['.txt'],
      'application/epub+zip': ['.epub'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          {isDragActive
            ? 'Drop files here...'
            : 'Drag & drop files here, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports PDF, DOCX, TXT, EPUB (max 10MB)
        </p>
      </div>

      {/* Upload progress */}
      {Object.entries(uploadProgress).map(([fileId, progress]) => (
        <Card key={fileId} className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Uploading...</p>
              <Progress value={progress} className="mt-2" />
            </div>
          </div>
        </Card>
      ))}

      {/* Sources list */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : sources && sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => (
            <Card key={source.id} className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{source.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.fileType.toUpperCase()} •{' '}
                    {formatBytes(source.fileSize)}
                    {source.wordCount &&
                      ` • ${source.wordCount.toLocaleString()} words`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status indicator */}
                  {source.processingStatus === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {source.processingStatus === 'processing' && (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  )}
                  {source.processingStatus === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {source.processingStatus === 'pending' && (
                    <Loader2 className="w-5 h-5 text-muted-foreground" />
                  )}

                  {/* Toggle activation */}
                  {source.processingStatus === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleActivation.mutate({
                          sourceMaterialId: source.id,
                          bookId,
                        })
                      }
                      title="Toggle source activation"
                    >
                      <ToggleRight className="w-4 h-4 text-green-500" />
                    </Button>
                  )}

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      deleteMutation.mutate({ sourceMaterialId: source.id })
                    }
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {source.processingStatus === 'failed' && source.processingError && (
                <p className="text-xs text-red-500 mt-2">
                  {source.processingError}
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No source materials yet. Upload documents to enhance Casper's
          knowledge about your book.
        </p>
      )}
    </div>
  );
}
