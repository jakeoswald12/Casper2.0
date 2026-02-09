import Anthropic from '@anthropic-ai/sdk';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  books,
  profiles,
  chatMessages,
  outlineItems,
} from '../../drizzle/schema';
import { retrieveFullContext, buildContextPrompt } from './ragRetrieval';
import type { Book, OutlineItem } from '../../drizzle/schema';

interface ChatRequest {
  message: string;
  bookId: number;
  sessionId: number;
  userId: number;
}

export interface SSEEvent {
  type: 'content' | 'tool_use' | 'error' | 'done';
  content: string;
}

/**
 * Stream a chat completion from Claude.
 * Retrieves full book context (sources, starred messages, outline)
 * and streams the AI response as SSE events.
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<SSEEvent> {
  // Get user profile for AI settings
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, request.userId),
  });

  // Get book details
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, request.bookId), eq(books.userId, request.userId)),
  });

  if (!book) {
    yield { type: 'error', content: 'Book not found or access denied' };
    return;
  }

  // Get outline
  const outline = await db.query.outlineItems.findMany({
    where: eq(outlineItems.bookId, request.bookId),
    orderBy: (items, { asc }) => [asc(items.position)],
  });

  // Get full context (active source materials + starred messages)
  const context = await retrieveFullContext(request.bookId, request.sessionId);

  // Get recent conversation history from DB
  // The current user message was already saved by the frontend before calling this endpoint
  const recentMessages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, request.sessionId),
    orderBy: [desc(chatMessages.createdAt)],
    limit: 30,
  });

  // Reverse to chronological order
  const conversationHistory = recentMessages.reverse();

  // Build system prompt with book context, outline, and sources
  const systemPrompt = buildSystemPrompt(book, outline, context);

  // Convert conversation history to Anthropic message format
  const anthropicMessages: Anthropic.MessageParam[] = conversationHistory.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // If the conversation doesn't end with the current user message
  // (race condition fallback), append it
  const lastMsg = anthropicMessages[anthropicMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== request.message) {
    anthropicMessages.push({ role: 'user', content: request.message });
  }

  // Determine API key
  const apiKey = profile?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield {
      type: 'error',
      content: 'No API key configured. Please add your Anthropic API key in Settings, or set ANTHROPIC_API_KEY on the server.',
    };
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  // Model settings from user profile
  const model = profile?.modelPreference || 'claude-opus-4-6';
  const temperature = (profile?.temperature ?? 7) / 10; // Convert 0-10 scale to 0.0-1.0
  const maxTokens = profile?.maxTokens || 4096;

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield { type: 'content', content: delta.text };
        }
      }
    }

    yield { type: 'done', content: '' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('Anthropic API error:', message);
    yield { type: 'error', content: message };
  }
}

/**
 * Build the system prompt that gives Claude full context about the book.
 */
function buildSystemPrompt(
  book: Book,
  outline: OutlineItem[],
  context: Awaited<ReturnType<typeof retrieveFullContext>>
): string {
  let prompt = `You are Casper, an expert AI writing assistant helping authors craft exceptional books. You combine deep literary knowledge with creative skill to produce publication-ready prose that matches each author's unique voice and vision.

## Current Book
- **Title:** ${book.title}`;

  if (book.subtitle) prompt += `\n- **Subtitle:** ${book.subtitle}`;
  if (book.summary) prompt += `\n- **Summary:** ${book.summary}`;
  if (book.writingStyle) prompt += `\n- **Writing Style:** ${book.writingStyle}`;
  if (book.targetAudience) prompt += `\n- **Target Audience:** ${book.targetAudience}`;

  // Add outline
  if (outline.length > 0) {
    prompt += '\n\n## Book Outline\n';
    for (const item of outline) {
      const indent =
        item.type === 'part' ? '' :
        item.type === 'chapter' ? '  ' :
        item.type === 'subsection' ? '    ' : '      ';
      prompt += `${indent}- [${item.type}] ${item.content}\n`;
    }
  }

  // Add source materials and starred messages via the context builder
  const contextPrompt = buildContextPrompt(context);
  if (contextPrompt) {
    prompt += contextPrompt;
  }

  // Context budget info
  const { budget } = context;
  prompt += `\n\n## Context Budget
- Sources included: ${context.sources.length} (${budget.sourceWordsUsed.toLocaleString()} words)
- Budget remaining: ${(budget.availableForSources - budget.sourceWordsUsed).toLocaleString()} words`;

  prompt += `\n\n## Guidelines
- Write in the author's specified style and tone
- Reference source materials when relevant to support and inform your writing
- Produce creative, engaging, publication-ready prose when asked to write
- Provide detailed, actionable ideas when brainstorming
- Keep responses focused on the book project
- When generating manuscript content, write in a natural narrative voice without meta-commentary`;

  return prompt;
}
