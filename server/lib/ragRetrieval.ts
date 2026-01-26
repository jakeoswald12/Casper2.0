import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  documentChunks,
  chatMessages,
  bookSourceActivations,
  sourceMaterials,
} from '../../drizzle/schema';

interface RetrievalContext {
  documentChunks: Array<{
    content: string;
    source: string;
    sourceTitle: string;
    pageNumber?: number;
    relevanceScore: number;
  }>;
  starredMessages: Array<{
    content: string;
    role: string;
    createdAt: Date;
  }>;
}

export async function retrieveContext(
  bookId: number,
  userQuery: string,
  sessionId?: number,
  maxChunks = 10,
  maxStarredMessages = 5
): Promise<RetrievalContext> {
  // Extract keywords from query
  const keywords = extractKeywords(userQuery);

  // Get active source materials for this book
  const activeSources = await db.query.bookSourceActivations.findMany({
    where: and(
      eq(bookSourceActivations.bookId, bookId),
      eq(bookSourceActivations.isActive, true)
    ),
    with: {
      sourceMaterial: true,
    },
  });

  const activeSourceIds = activeSources.map((as) => as.sourceMaterialId);

  if (activeSourceIds.length === 0) {
    return {
      documentChunks: [],
      starredMessages: await getStarredMessages(sessionId, maxStarredMessages),
    };
  }

  // Retrieve document chunks for active sources
  const chunks = await db.query.documentChunks.findMany({
    where: and(
      eq(documentChunks.bookId, bookId),
      inArray(documentChunks.sourceMaterialId, activeSourceIds)
    ),
  });

  // Score chunks by keyword relevance
  const scoredChunks = chunks.map((chunk) => {
    let score = 0;
    const content = chunk.content.toLowerCase();

    for (const keyword of keywords) {
      const regex = new RegExp(escapeRegex(keyword), 'gi');
      const matches = content.match(regex);
      if (matches) {
        // Weight by keyword length and match count
        score += matches.length * keyword.length;
      }
    }

    // Get source info
    const sourceActivation = activeSources.find(
      (as) => as.sourceMaterialId === chunk.sourceMaterialId
    );
    const sourceTitle = sourceActivation?.sourceMaterial?.title || 'Unknown Source';

    return {
      ...chunk,
      score,
      sourceTitle,
    };
  });

  // Sort by score and take top chunks
  const topChunks = scoredChunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  // Get starred messages if session provided
  const starredMessages = await getStarredMessages(sessionId, maxStarredMessages);

  return {
    documentChunks: topChunks.map((chunk) => ({
      content: chunk.content,
      source: `Source ${chunk.sourceMaterialId}`,
      sourceTitle: chunk.sourceTitle,
      pageNumber: chunk.pageNumber || undefined,
      relevanceScore: chunk.score,
    })),
    starredMessages,
  };
}

async function getStarredMessages(
  sessionId: number | undefined,
  limit: number
): Promise<Array<{ content: string; role: string; createdAt: Date }>> {
  if (!sessionId) {
    return [];
  }

  const messages = await db.query.chatMessages.findMany({
    where: and(
      eq(chatMessages.sessionId, sessionId),
      eq(chatMessages.isStarred, true)
    ),
    orderBy: [desc(chatMessages.createdAt)],
    limit,
  });

  return messages.map((msg) => ({
    content: msg.content,
    role: msg.role,
    createdAt: msg.createdAt,
  }));
}

function extractKeywords(query: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'it',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'we',
    'they',
    'what',
    'which',
    'who',
    'when',
    'where',
    'why',
    'how',
    'me',
    'my',
    'your',
    'our',
    'their',
    'its',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'all',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'also',
    'now',
    'write',
    'tell',
    'help',
    'please',
    'want',
    'need',
    'make',
    'get',
  ]);

  // Extract words, filter stop words, and lowercase
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Remove duplicates and return
  return Array.from(new Set(words));
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build context string for system prompt
export function buildRAGContextPrompt(context: RetrievalContext): string {
  let prompt = '';

  if (context.documentChunks.length > 0) {
    prompt += '\n\n<source_materials>\n';
    prompt +=
      'The user has uploaded source materials. Here are relevant excerpts:\n\n';

    context.documentChunks.forEach((chunk, i) => {
      prompt += `--- Source ${i + 1}: ${chunk.sourceTitle}`;
      if (chunk.pageNumber) {
        prompt += ` (Page ${chunk.pageNumber})`;
      }
      prompt += ' ---\n';
      prompt += chunk.content.substring(0, 800);
      if (chunk.content.length > 800) {
        prompt += '...';
      }
      prompt += '\n\n';
    });

    prompt += '</source_materials>';
  }

  if (context.starredMessages.length > 0) {
    prompt += '\n\n<starred_insights>\n';
    prompt +=
      'The user has starred these important messages from previous conversations:\n\n';

    context.starredMessages.forEach((msg, i) => {
      prompt += `${i + 1}. [${msg.role}]: ${msg.content}\n\n`;
    });

    prompt += '</starred_insights>';
  }

  return prompt;
}
