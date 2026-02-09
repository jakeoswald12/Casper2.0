# Database Schema Reference

## Schema Location
All tables defined in `drizzle/schema.ts`. Use Drizzle Kit for migrations.

## Tables Overview

### User Management
- **users**: Core user record (openId, name, email, role, timestamps)
- **profiles**: User preferences - theme, fontSize, editorMode, AI settings (model default `claude-opus-4-6`, temperature, maxTokens, extendedThinking), notification prefs

### Content
- **books**: User's book projects (title, subtitle, summary, writingStyle, targetAudience, summaryStructure as JSONB)
- **outlineItems**: Hierarchical tree structure (id, parentId, bookId, type: part/chapter/subsection/bullet, position)
- **manuscripts**: Chapter content (bookId, chapterId references outlineItems.id, content as Lexical JSON, wordCount)

### Source Materials
- **sourceMaterials**: Uploaded files and their full extracted text
  - Core fields: bookId, userId, title, filename, fileType, fileSize, storagePath
  - Processing: processingStatus (pending/processing/completed/failed), processingError, processedAt
  - Content: `extractedText` (full document text, no chunking), `wordCount`
  - Activation: `isActive` (boolean, whether included in AI context)
  - Metadata: authorName, pageCount, metadata (JSONB)

**Note**: There are NO `documentChunks` or `bookSourceActivations` tables. Full text is stored directly on `sourceMaterials.extractedText` and activation is tracked via `sourceMaterials.isActive`.

### Chat
- **chatSessions**: Conversation containers (bookId, userId, title, isActive, lastMessageAt)
- **chatMessages**: Individual messages (sessionId, bookId, userId, role: user/assistant, content, isStarred, metadata as JSONB)

### Library / Publishing
- **libraryBooks**: Published books for public browsing (sourceBookId, title, author, description, coverImage, genre, keywords as JSONB, isPublic, viewCount)
- **libraryBookChapters**: Published chapter content (libraryBookId, chapterNumber, title, content, wordCount)

### Billing
- **subscriptions**: Stripe subscription state (userId unique, stripeCustomerId, stripeSubscriptionId, plan: free/pro/enterprise, status, currentPeriodEnd, cancelAtPeriodEnd)
- **usageTracking**: Resource consumption log (userId, resourceType: ai_tokens/storage/exports, amount, metadata)

## Key Relationships
- users 1:N books, profiles, chatSessions, sourceMaterials, subscriptions
- books 1:N outlineItems, manuscripts, sourceMaterials, chatSessions, chatMessages
- chatSessions 1:N chatMessages
- libraryBooks 1:N libraryBookChapters

## Index Strategy
- Foreign keys indexed on userId, bookId, sessionId
- Status fields indexed: processingStatus, isStarred
- Unique constraints: users.openId, profiles.userId, subscriptions.userId

## Migration Commands
```bash
pnpm db:generate  # Generate migration SQL
pnpm db:migrate   # Apply migrations
pnpm db:push      # Push schema directly (dev)
pnpm db:studio    # Open Drizzle Studio GUI
```
