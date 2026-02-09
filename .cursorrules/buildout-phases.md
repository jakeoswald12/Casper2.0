# Build-Out Phases Reference

## Implementation Roadmap (from build-out plans)

### Phase 1: Foundation & Source Material System (Weeks 1-2) - CURRENT
- PostgreSQL migration (from MySQL) with Drizzle ORM
- Database schema for all tables (users, books, outlines, manuscripts, sources, chat, library, subscriptions)
- File upload system with S3 presigned URLs
- Document processing pipeline (BullMQ + pdf-parse/mammoth/epub-parser)
- Full-text extraction stored on `sourceMaterials.extractedText` (no chunking/RAG)
- Context budget system (600K words, dynamically allocated)
- Grep-style search across source materials

### Phase 2: Lexical Rich Text Editor (Weeks 3-4)
- Replace textarea with Lexical editor
- Custom nodes: SectionMarkerNode
- Plugins: AIIntegrationPlugin, AutoSavePlugin, LineNumberPlugin, ToolbarPlugin
- Typewriter streaming effect for AI content insertion

### Phase 3: Chat Persistence & Enhancement (Week 5)
- Chat sessions with database persistence
- Message starring for context inclusion
- Session management UI (create, rename, delete)
- Streaming responses from Claude

### Phase 4: Summary Editor (Week 6)
- Hierarchical summary structure (JSONB in books table)
- Drag-and-drop reordering (dnd-kit)
- Default sections: Overview, Target Audience, Tone & Style, Context & Setting, Characters
- Auto-save

### Phase 5: Export System (Week 7)
- DOCX generation with docx library
- Hierarchical heading structure (parts -> chapters -> subsections)
- Title page, proper formatting, headers/footers
- S3-based download with presigned URLs

### Phase 6: Settings & Configuration (Week 8)
- Profiles table for user preferences
- Settings tabs: Account, Interface, AI, Notifications
- Theme switching, font size, editor mode
- AI model/temperature/token configuration

### Phase 7: Testing & Polish (Week 9)
- Vitest unit tests (80%+ coverage target)
- Playwright E2E tests (auth, books, chat, export)
- Code splitting, lazy loading, performance optimization
- Error boundaries, loading states

### Phase 8: Library System (Weeks 10-11)
- Publishing workflow (book -> library book with chapters)
- Public browsing with search, genre filters, pagination
- Add library books as full-text source materials

### Phase 9: Stripe & Monetization (Weeks 12-13)
- Three tiers: Free, Pro ($29/mo), Enterprise ($99/mo)
- Stripe Checkout sessions and Customer Portal
- Webhook handling for subscription lifecycle
- Usage tracking (AI tokens, storage, exports)

### Phase 10: Advanced Features (Weeks 14-15)
- Analytics dashboard
- Voice features (future)
- Team collaboration (future)

## When Working on Features
- Check which phase the feature belongs to
- Follow the implementation pattern from the corresponding build-out plan
- Maintain consistency with existing patterns in the codebase
- Always add appropriate tests
