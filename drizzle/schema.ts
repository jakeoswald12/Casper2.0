import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===== USERS =====

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  openId: varchar('open_id', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('login_method', { length: 64 }),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSignedIn: timestamp('last_signed_in').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  books: many(books),
  sourceMaterials: many(sourceMaterials),
  chatSessions: many(chatSessions),
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

// ===== USER PROFILES =====

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id)
    .unique(),
  bio: text('bio'),
  penName: text('pen_name'),
  profilePicture: text('profile_picture'),

  // Interface settings
  theme: varchar('theme', { length: 20 }).default('system'),
  fontSize: varchar('font_size', { length: 20 }).default('medium'),
  editorMode: varchar('editor_mode', { length: 20 }).default('rich'),
  autoSaveInterval: integer('auto_save_interval').default(1000),

  // AI settings
  anthropicApiKey: text('anthropic_api_key'),
  modelPreference: varchar('model_preference', { length: 50 }).default('claude-sonnet-4-5-20250514'),
  temperature: integer('temperature').default(7), // 0-10 scale
  maxTokens: integer('max_tokens').default(4096),
  extendedThinking: boolean('extended_thinking').default(false),

  // Notification settings
  emailNotifications: boolean('email_notifications').default(true),
  exportNotifications: boolean('export_notifications').default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== BOOKS =====

export const books = pgTable(
  'books',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    summary: text('summary'),
    writingStyle: varchar('writing_style', { length: 255 }),
    targetAudience: text('target_audience'),
    // JSONB field for hierarchical summary
    summaryStructure: jsonb('summary_structure'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('books_user_id_idx').on(table.userId),
  })
);

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, {
    fields: [books.userId],
    references: [users.id],
  }),
  outlineItems: many(outlineItems),
  manuscripts: many(manuscripts),
  sourceMaterials: many(sourceMaterials),
  chatSessions: many(chatSessions),
  sourceActivations: many(bookSourceActivations),
}));

// ===== OUTLINE ITEMS =====

export const outlineItems = pgTable(
  'outline_items',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    parentId: varchar('parent_id', { length: 255 }),
    type: varchar('type', { length: 20 }).notNull(), // 'part', 'chapter', 'subsection', 'bullet'
    content: text('content').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    bookIdIdx: index('outline_items_book_id_idx').on(table.bookId),
    parentIdIdx: index('outline_items_parent_id_idx').on(table.parentId),
  })
);

export const outlineItemsRelations = relations(outlineItems, ({ one }) => ({
  book: one(books, {
    fields: [outlineItems.bookId],
    references: [books.id],
  }),
}));

// ===== MANUSCRIPTS =====

export const manuscripts = pgTable(
  'manuscripts',
  {
    id: serial('id').primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    chapterId: varchar('chapter_id', { length: 255 }).notNull(),
    content: text('content'),
    wordCount: integer('word_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    bookIdIdx: index('manuscripts_book_id_idx').on(table.bookId),
    chapterIdIdx: index('manuscripts_chapter_id_idx').on(table.chapterId),
  })
);

export const manuscriptsRelations = relations(manuscripts, ({ one }) => ({
  book: one(books, {
    fields: [manuscripts.bookId],
    references: [books.id],
  }),
}));

// ===== SOURCE MATERIALS (RAG) =====

export const sourceMaterials = pgTable(
  'source_materials',
  {
    id: serial('id').primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 50 }).notNull(), // 'pdf', 'docx', 'txt', 'epub', 'library'
    fileSize: integer('file_size').notNull(),
    storagePath: text('storage_path').notNull(), // S3 path
    processingStatus: varchar('processing_status', { length: 50 })
      .default('pending')
      .notNull(),
    // Status: 'pending', 'processing', 'completed', 'failed'
    processingError: text('processing_error'),
    processedAt: timestamp('processed_at'),
    // Metadata extracted during processing
    authorName: text('author_name'),
    pageCount: integer('page_count'),
    wordCount: integer('word_count'),
    metadata: jsonb('metadata'), // Additional extracted metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    bookIdIdx: index('source_materials_book_id_idx').on(table.bookId),
    userIdIdx: index('source_materials_user_id_idx').on(table.userId),
    statusIdx: index('source_materials_status_idx').on(table.processingStatus),
  })
);

export const sourceMaterialsRelations = relations(sourceMaterials, ({ one, many }) => ({
  book: one(books, {
    fields: [sourceMaterials.bookId],
    references: [books.id],
  }),
  user: one(users, {
    fields: [sourceMaterials.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
  activations: many(bookSourceActivations),
}));

// ===== DOCUMENT CHUNKS (RAG) =====

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: serial('id').primaryKey(),
    sourceMaterialId: integer('source_material_id')
      .notNull()
      .references(() => sourceMaterials.id, { onDelete: 'cascade' }),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    chunkSize: integer('chunk_size').notNull(),
    pageNumber: integer('page_number'),
    sectionTitle: text('section_title'),
    // For semantic search (optional - can add later with pgvector)
    // embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceMaterialIdIdx: index('document_chunks_source_material_id_idx').on(
      table.sourceMaterialId
    ),
    bookIdIdx: index('document_chunks_book_id_idx').on(table.bookId),
  })
);

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  sourceMaterial: one(sourceMaterials, {
    fields: [documentChunks.sourceMaterialId],
    references: [sourceMaterials.id],
  }),
  book: one(books, {
    fields: [documentChunks.bookId],
    references: [books.id],
  }),
}));

// ===== BOOK SOURCE ACTIVATIONS =====

export const bookSourceActivations = pgTable(
  'book_source_activations',
  {
    id: serial('id').primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    sourceMaterialId: integer('source_material_id')
      .notNull()
      .references(() => sourceMaterials.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').default(true).notNull(),
    activatedAt: timestamp('activated_at').defaultNow().notNull(),
  },
  (table) => ({
    bookIdIdx: index('book_source_activations_book_id_idx').on(table.bookId),
    uniqueActivation: uniqueIndex('book_source_activations_unique').on(
      table.bookId,
      table.sourceMaterialId
    ),
  })
);

export const bookSourceActivationsRelations = relations(
  bookSourceActivations,
  ({ one }) => ({
    book: one(books, {
      fields: [bookSourceActivations.bookId],
      references: [books.id],
    }),
    sourceMaterial: one(sourceMaterials, {
      fields: [bookSourceActivations.sourceMaterialId],
      references: [sourceMaterials.id],
    }),
  })
);

// ===== CHAT SESSIONS =====

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: serial('id').primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  },
  (table) => ({
    bookIdIdx: index('chat_sessions_book_id_idx').on(table.bookId),
    userIdIdx: index('chat_sessions_user_id_idx').on(table.userId),
  })
);

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  book: one(books, {
    fields: [chatSessions.bookId],
    references: [books.id],
  }),
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

// ===== CHAT MESSAGES =====

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull(), // 'user' or 'assistant'
    content: text('content').notNull(),
    isStarred: boolean('is_starred').default(false).notNull(),
    metadata: jsonb('metadata'), // For storing tool calls, thinking process, etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('chat_messages_session_id_idx').on(table.sessionId),
    bookIdIdx: index('chat_messages_book_id_idx').on(table.bookId),
    starredIdx: index('chat_messages_starred_idx').on(table.isStarred),
  })
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
  book: one(books, {
    fields: [chatMessages.bookId],
    references: [books.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

// ===== LIBRARY BOOKS =====

export const libraryBooks = pgTable(
  'library_books',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    sourceBookId: integer('source_book_id').references(() => books.id),
    title: text('title').notNull(),
    author: text('author').notNull(),
    description: text('description'),
    coverImage: text('cover_image'),
    isbn: varchar('isbn', { length: 13 }),
    genre: varchar('genre', { length: 100 }),
    keywords: jsonb('keywords'), // string[]
    isPublic: boolean('is_public').default(true).notNull(),
    viewCount: integer('view_count').default(0),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    authorIdx: index('library_books_author_idx').on(table.author),
    genreIdx: index('library_books_genre_idx').on(table.genre),
  })
);

export const libraryBooksRelations = relations(libraryBooks, ({ one, many }) => ({
  user: one(users, {
    fields: [libraryBooks.userId],
    references: [users.id],
  }),
  sourceBook: one(books, {
    fields: [libraryBooks.sourceBookId],
    references: [books.id],
  }),
  chapters: many(libraryBookChapters),
}));

// ===== LIBRARY BOOK CHAPTERS =====

export const libraryBookChapters = pgTable(
  'library_book_chapters',
  {
    id: serial('id').primaryKey(),
    libraryBookId: integer('library_book_id')
      .notNull()
      .references(() => libraryBooks.id, { onDelete: 'cascade' }),
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    wordCount: integer('word_count').default(0),
  },
  (table) => ({
    libraryBookIdIdx: index('library_book_chapters_library_book_id_idx').on(
      table.libraryBookId
    ),
  })
);

export const libraryBookChaptersRelations = relations(
  libraryBookChapters,
  ({ one }) => ({
    libraryBook: one(libraryBooks, {
      fields: [libraryBookChapters.libraryBookId],
      references: [libraryBooks.id],
    }),
  })
);

// ===== SUBSCRIPTIONS =====

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id)
    .unique(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  plan: varchar('plan', { length: 50 }).notNull(), // 'free', 'pro', 'enterprise'
  status: varchar('status', { length: 50 }).notNull(), // 'active', 'canceled', 'past_due'
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== USAGE TRACKING =====

export const usageTracking = pgTable(
  'usage_tracking',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'ai_tokens', 'storage', 'exports'
    amount: integer('amount').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('usage_tracking_user_id_idx').on(table.userId),
    typeIdx: index('usage_tracking_type_idx').on(table.resourceType),
  })
);

// ===== TYPE EXPORTS =====

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type OutlineItem = typeof outlineItems.$inferSelect;
export type NewOutlineItem = typeof outlineItems.$inferInsert;
export type Manuscript = typeof manuscripts.$inferSelect;
export type NewManuscript = typeof manuscripts.$inferInsert;
export type SourceMaterial = typeof sourceMaterials.$inferSelect;
export type NewSourceMaterial = typeof sourceMaterials.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type BookSourceActivation = typeof bookSourceActivations.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type LibraryBook = typeof libraryBooks.$inferSelect;
export type NewLibraryBook = typeof libraryBooks.$inferInsert;
export type LibraryBookChapter = typeof libraryBookChapters.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type UsageTracking = typeof usageTracking.$inferSelect;
