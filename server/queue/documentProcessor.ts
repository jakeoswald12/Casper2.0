import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sourceMaterials } from '../../drizzle/schema';
import { getObject } from '../lib/s3';
import type { SourceMaterial } from '../../drizzle/schema';

// Check if Redis is available
const REDIS_AVAILABLE = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

// BullMQ queue and worker (only if Redis available)
let documentQueue: any = null;
let documentWorker: any = null;

if (REDIS_AVAILABLE) {
  // Dynamically import BullMQ only when Redis is available
  import('bullmq').then(({ Queue, Worker }) => {
    const redisConnection = process.env.REDIS_URL
      ? { url: process.env.REDIS_URL }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        };

    documentQueue = new Queue('document-processing', {
      connection: redisConnection,
    });

    documentWorker = new Worker(
      'document-processing',
      async (job: any) => {
        await processDocument(job.data.sourceMaterialId);
      },
      { connection: redisConnection }
    );

    documentWorker.on('completed', (job: any) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    documentWorker.on('failed', (job: any, err: Error) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });
  }).catch((err) => {
    console.warn('BullMQ not available, using synchronous processing:', err.message);
  });
}

// Core document processing logic
// Extracts full text from documents and stores it directly on the source material record.
// No chunking - we use Claude Opus 4.6's 1M token context window to include full source text.
async function processDocument(sourceMaterialId: number): Promise<{ success: boolean }> {
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

    // Store full extracted text directly on the source material record
    await db
      .update(sourceMaterials)
      .set({
        processingStatus: 'completed',
        processedAt: new Date(),
        extractedText,
        wordCount,
        pageCount: (metadata.pageCount as number) || null,
        authorName: (metadata.author as string) || null,
        metadata: metadata,
      })
      .where(eq(sourceMaterials.id, sourceMaterialId));

    return { success: true };
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
}

// Add job to queue (or process synchronously if no Redis)
export async function addToProcessingQueue(source: SourceMaterial) {
  if (documentQueue) {
    // Use BullMQ queue if available
    await documentQueue.add(
      'process-document',
      { sourceMaterialId: source.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  } else {
    // Process synchronously (for serverless/no-Redis environments)
    // Run in background without blocking the response
    processDocument(source.id).catch((err) => {
      console.error('Sync document processing failed:', err);
    });
  }
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
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

// Strip HTML tags from XHTML content, preserving paragraph breaks
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// EPUB text extraction using epub-parser (supports Buffer input)
async function extractEpubText(
  buffer: Buffer
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const epubParser = await import('epub-parser');
  const parser = epubParser.default || epubParser;

  return new Promise((resolve, reject) => {
    parser.open(buffer, (err: Error | null, epubData: any) => {
      if (err) return reject(err);

      try {
        const opsRoot: string = epubData.paths.opsRoot || '';
        const linearSpine = epubData.easy.linearSpine || {};
        const chapters: string[] = [];

        // Extract text from each spine item in reading order
        for (const id of Object.keys(linearSpine)) {
          const item = linearSpine[id]?.item;
          if (!item?.$ ?.href) continue;

          const mediaType: string = item.$['media-type'] || '';
          if (!mediaType.match(/html|xhtml/i)) continue;

          try {
            const xhtml = parser.extractText(opsRoot + item.$.href);
            const plainText = stripHtml(xhtml);
            if (plainText.trim()) {
              chapters.push(plainText.trim());
            }
          } catch {
            // Skip files that can't be extracted
          }
        }

        // Extract metadata from simpleMeta array
        const metadata: Record<string, unknown> = {};
        const simpleMeta: Record<string, string>[] = epubData.easy.simpleMeta || [];
        for (const m of simpleMeta) {
          const key = Object.keys(m)[0];
          if (!key) continue;
          if (/creator|author/i.test(key) && !metadata.author) metadata.author = m[key];
          if (/title/i.test(key) && !metadata.title) metadata.title = m[key];
          if (/publisher/i.test(key)) metadata.publisher = m[key];
          if (/language/i.test(key)) metadata.language = m[key];
        }

        resolve({
          text: chapters.join('\n\n'),
          metadata,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export { documentQueue, documentWorker };
