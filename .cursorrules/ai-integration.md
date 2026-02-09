# AI Integration Rules

## Claude API
- Using `@anthropic-ai/sdk` package
- Default model: Claude Opus 4.6 (`claude-opus-4-6`) with 1M token context window
- User-configurable in profile settings: model, temperature (0-10 scale), maxTokens, extendedThinking

## Context Strategy: Full-Context Inclusion (No RAG)
We do NOT use RAG, chunking, or vector search. Instead, we leverage Claude Opus 4.6's
1M token context window (~750,000 words) to include full source material text directly
in the system prompt.

### Context Budget
- **Total budget**: 600,000 words (80% of the ~750K word capacity)
- **20% reserved** for system prompt, conversation history, and AI response
- **Dynamic source limit**: `availableForSources = 600,000 - manuscriptWords - outlineWords - 3,000 (prompt overhead)`
- As the manuscript grows, the space available for source materials shrinks automatically

## System Prompt Construction
The Claude system prompt is built dynamically with:
1. Base Casper personality/instructions (~3,000 words overhead)
2. Book context (title, subtitle, summary, writing style, target audience)
3. Current outline structure
4. Full source material text (all active sources, up to budget limit)
5. Starred chat messages (up to 5)

## Source Material Context Format
```xml
<source_materials>
The following source materials have been uploaded by the user.
Use them to inform your writing and responses.

--- Source Title by Author Name (12,345 words) ---
[full extracted text...]

--- Another Source (8,000 words) ---
[full extracted text...]
</source_materials>

<starred_insights>
The user has starred these important messages from previous conversations:

1. [role]: [starred message content]
</starred_insights>
```

## Streaming Responses
- AI responses are streamed to the frontend
- Messages are saved to database after completion
- Both user and assistant messages stored in `chatMessages` table

## Agent Tool System
- The AI can call tools to modify book state (update title, add chapters, modify outline)
- Tool definitions provided in system prompt
- Tool results fed back into conversation

## Document Processing Pipeline
- Files uploaded to S3, then processed to extract full text
- Supported: PDF (pdf-parse), DOCX (mammoth), TXT, EPUB
- Full extracted text stored on `sourceMaterials.extractedText` (no chunking)
- Word count calculated and stored on `sourceMaterials.wordCount`
- BullMQ queue with Redis (falls back to sync processing if no Redis)

## Grep/Search Across Sources
- Case-insensitive keyword search across all source material text
- Returns matching lines with surrounding context (2 lines before/after)
- Available via `files.search` tRPC endpoint
- Used for targeted content lookup without including everything in prompt

## Best Practices
- Never expose API keys to the frontend - all Claude calls go through the server
- Handle rate limits and API errors gracefully
- Log token usage for billing/usage tracking
- Respect user's model/temperature preferences from profile settings
- Strip `extractedText` from API responses to clients (avoid sending huge payloads)
- Show users their context budget usage (manuscriptWords + outlineWords + sourceWords / 600K)
