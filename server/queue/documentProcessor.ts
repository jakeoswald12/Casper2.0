import { Queue, Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sourceMaterials, documentChunks } from '../../drizzle/schema';
import { getObject } from '../lib/s3';
import type { SourceMaterial } from '../../drizzle/schema';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Create queue
export const documentQueue = new Queue('document-processing', {
  connection: redisConnection,
});

// Create worker
export const documentWorker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { sourceMaterialId } = job.data;

    try {
      // Update status to processing
      await db
        .update(sourceMaterials)
        .set({ processingStatus: 'processing' })
        .where(eq(sourceMaterials.id, sourceMaterialId));

      // Get source material
      const source = await db.query.sourceMaterials.findFirst({
        where: eq(sourceMaterials.id, sourceMaterialId),
      });

      if (!source) {
        throw new Error('Source material not found');
      }

      // Download from S3
      const s3Object = await getObject(source.storagePath);
      const buffer = await streamToBuffer(s3Object.Body);

      // Extract text based on file type
      let extractedText = '';
      let metadata: Record<string, unknown> = {};

      switch (source.fileType.toLowerCase()) {
        case 'pdf':
          const pdfResult = await extractPdfText(buffer);
          extractedText = pdfResult.text;
          metadata = pdfResult.metadata;
          break;

        case 'docx':
          const docxResult = await extractDocxText(buffer);
          extractedText = docxResult.text;
          metadata = docxResult.metadata;
          break;

        case 'txt':
          extractedText = buffer.toString('utf-8');
          break;

        case 'epub':
          const epubResult = await extractEpubText(buffer);
          extractedText = epubResult.text;
          metadata = epubResult.metadata;
          break;

        default:
          throw new Error(`Unsupported file type: ${source.fileType}`);
      }

      // Calculate word count
      const wordCount = extractedText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      // Create chunks
      const chunks = createChunks(extractedText, 1000);

      // Save chunks to database
      for (let i = 0; i < chunks.length; i++) {
        await db.insert(documentChunks).values({
          sourceMaterialId: source.id,
          bookId: source.bookId,
          userId: source.userId,
          content: chunks[i].content,
          chunkIndex: i,
          chunkSize: chunks[i].content.length,
          pageNumber: chunks[i].pageNumber,
          sectionTitle: chunks[i].sectionTitle,
        });
      }

      // Update source material with results
      await db
        .update(sourceMaterials)
        .set({
          processingStatus: 'completed',
          processedAt: new Date(),
          wordCount,
          pageCount: (metadata.pageCount as number) || null,
          authorName: (metadata.author as string) || null,
          metadata: metadata,
        })
        .where(eq(sourceMaterials.id, sourceMaterialId));

      return { success: true, chunks: chunks.length };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // Update status to failed
      await db
        .update(sourceMaterials)
        .set({
          processingStatus: 'failed',
          processingError: errorMessage,
        })
        .where(eq(sourceMaterials.id, sourceMaterialId));

      throw error;
    }
  },
  { connection: redisConnection }
);

// Listen for worker events
documentWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

documentWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

// Add job to queue
export async function addToProcessingQueue(source: SourceMaterial) {
  await documentQueue.add(
    'process-document',
    {
      sourceMaterialId: source.id,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}

// Helper function to create intelligent chunks
interface ChunkInfo {
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
}

function createChunks(text: string, maxChunkSize: number): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed max size, save current chunk
    if (
      currentChunk.length + trimmed.length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push({
        content: currentChunk.trim(),
      });
      currentChunk = '';
    }

    // If single paragraph is larger than max size, split it by sentences
    if (trimmed.length > maxChunkSize) {
      const sentences = trimmed.split(/[.!?]+\s+/);
      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length > maxChunkSize &&
          currentChunk.length > 0
        ) {
          chunks.push({
            content: currentChunk.trim(),
          });
          currentChunk = '';
        }
        currentChunk += sentence + '. ';
      }
    } else {
      currentChunk += trimmed + '\n\n';
    }
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
    });
  }

  return chunks;
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readable = stream as any;
  return new Promise((resolve, reject) => {
    readable.on('data', (chunk: Buffer) => chunks.push(chunk));
    readable.on('error', reject);
    readable.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// PDF text extraction
async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  // Dynamic import for pdf-parse
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: {
      pageCount: data.numpages,
      author: data.info?.Author,
      title: data.info?.Title,
    },
  };
}

// DOCX text extraction
async function extractDocxText(
  buffer: Buffer
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    metadata: {},
  };
}

// EPUB text extraction (simplified)
async function extractEpubText(
  _buffer: Buffer
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  // Note: epub-parser may need different handling
  // For now, return empty - can be implemented with proper epub library
  return {
    text: '',
    metadata: {},
  };
}
