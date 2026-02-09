import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  chatMessages,
  sourceMaterials,
  manuscripts,
  outlineItems,
} from '../../drizzle/schema';

// ===== CONTEXT BUDGET =====
// Claude Opus 4.6 has a 1M token context window (~750,000 words).
// We reserve 80% (800K tokens / ~600,000 words) for user content
// and 20% (200K tokens) for system prompt, conversation history, and response.
const TOTAL_CONTEXT_WORDS = 600_000;
const PROMPT_OVERHEAD_WORDS = 3_000; // system prompt, enriched prompt, formatting

/**
 * Calculate the available word budget for source materials,
 * accounting for manuscript and outline size.
 */
export function calculateContextBudget(
  manuscriptWordCount: number,
  outlineWordCount: number
): { totalBudget: number; used: number; availableForSources: number } {
  const used = manuscriptWordCount + outlineWordCount + PROMPT_OVERHEAD_WORDS;
  const availableForSources = Math.max(0, TOTAL_CONTEXT_WORDS - used);
  return {
    totalBudget: TOTAL_CONTEXT_WORDS,
    used,
    availableForSources,
  };
}

// ===== FULL CONTEXT RETRIEVAL =====

interface FullContext {
  sources: Array<{
    title: string;
    authorName: string | null;
    wordCount: number;
    content: string;
  }>;
  starredMessages: Array<{
    content: string;
    role: string;
    createdAt: Date;
  }>;
  budget: {
    totalBudget: number;
    used: number;
    availableForSources: number;
    sourceWordsUsed: number;
  };
}

/**
 * Retrieve full context for the AI prompt.
 * Includes complete text from all active source materials (no chunking).
 * Enforces the 600K word budget across sources + manuscript + outline.
 */
export async function retrieveFullContext(
  bookId: number,
  sessionId?: number,
  maxStarredMessages = 5
): Promise<FullContext> {
  // Get manuscript word count for this book
  const bookManuscripts = await db.query.manuscripts.findMany({
    where: eq(manuscripts.bookId, bookId),
  });
  const manuscriptWordCount = bookManuscripts.reduce(
    (sum, m) => sum + (m.wordCount || 0),
    0
  );

  // Get outline word count
  const bookOutline = await db.query.outlineItems.findMany({
    where: eq(outlineItems.bookId, bookId),
  });
  const outlineWordCount = bookOutline.reduce(
    (sum, item) => sum + item.content.split(/\s+/).length,
    0
  );

  // Calculate available budget for sources
  const budget = calculateContextBudget(manuscriptWordCount, outlineWordCount);

  // Get active, completed source materials for this book
  const activeSources = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.bookId, bookId),
      eq(sourceMaterials.isActive, true),
      eq(sourceMaterials.processingStatus, 'completed')
    ),
    orderBy: (sources, { asc }) => [asc(sources.createdAt)],
  });

  // Include full source text up to the budget limit
  const includedSources: FullContext['sources'] = [];
  let sourceWordsUsed = 0;

  for (const source of activeSources) {
    const sourceWords = source.wordCount || 0;
    if (sourceWordsUsed + sourceWords > budget.availableForSources) {
      // Would exceed budget - skip this source
      break;
    }

    if (source.extractedText) {
      includedSources.push({
        title: source.title,
        authorName: source.authorName,
        wordCount: sourceWords,
        content: source.extractedText,
      });
      sourceWordsUsed += sourceWords;
    }
  }

  // Get starred messages
  const starredMessages = await getStarredMessages(sessionId, maxStarredMessages);

  return {
    sources: includedSources,
    starredMessages,
    budget: {
      ...budget,
      sourceWordsUsed,
    },
  };
}

// ===== GREP / KEYWORD SEARCH =====

interface SearchResult {
  sourceTitle: string;
  sourceMaterialId: number;
  matches: Array<{
    line: number;
    content: string;
    context: string; // surrounding text for context
  }>;
}

/**
 * Grep-style search across all source materials for a book.
 * Uses case-insensitive text matching to find specific content.
 */
export async function searchSources(
  bookId: number,
  query: string,
  maxResultsPerSource = 10
): Promise<SearchResult[]> {
  // Get completed source materials with extracted text
  const sources = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.bookId, bookId),
      eq(sourceMaterials.processingStatus, 'completed')
    ),
  });

  const results: SearchResult[] = [];
  const searchTerms = query.toLowerCase().trim();

  for (const source of sources) {
    if (!source.extractedText) continue;

    const lines = source.extractedText.split('\n');
    const matches: SearchResult['matches'] = [];

    for (let i = 0; i < lines.length && matches.length < maxResultsPerSource; i++) {
      if (lines[i].toLowerCase().includes(searchTerms)) {
        // Get surrounding context (2 lines before and after)
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length - 1, i + 2);
        const context = lines.slice(contextStart, contextEnd + 1).join('\n');

        matches.push({
          line: i + 1,
          content: lines[i],
          context,
        });
      }
    }

    if (matches.length > 0) {
      results.push({
        sourceTitle: source.title,
        sourceMaterialId: source.id,
        matches,
      });
    }
  }

  return results;
}

// ===== CONTEXT PROMPT BUILDER =====

/**
 * Build the context portion of the system prompt.
 * Includes full source material text (not chunks) and starred messages.
 */
export function buildContextPrompt(context: FullContext): string {
  let prompt = '';

  if (context.sources.length > 0) {
    prompt += '\n\n<source_materials>\n';
    prompt +=
      'The following source materials have been uploaded by the user. ' +
      'Use them to inform your writing and responses.\n\n';

    for (const source of context.sources) {
      prompt += `--- ${source.title}`;
      if (source.authorName) {
        prompt += ` by ${source.authorName}`;
      }
      prompt += ` (${source.wordCount.toLocaleString()} words) ---\n`;
      prompt += source.content;
      prompt += '\n\n';
    }

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

// ===== HELPERS =====

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
