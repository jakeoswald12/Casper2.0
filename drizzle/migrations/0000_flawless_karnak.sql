CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"summary" text,
	"writing_style" varchar(255),
	"target_audience" text,
	"summary_structure" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_book_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"library_book_id" integer NOT NULL,
	"chapter_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"word_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "library_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"source_book_id" integer,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"description" text,
	"cover_image" text,
	"isbn" varchar(13),
	"genre" varchar(100),
	"keywords" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_id" varchar(255) NOT NULL,
	"content" text,
	"word_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outline_items" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"parent_id" varchar(255),
	"type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bio" text,
	"pen_name" text,
	"profile_picture" text,
	"theme" varchar(20) DEFAULT 'system',
	"font_size" varchar(20) DEFAULT 'medium',
	"editor_mode" varchar(20) DEFAULT 'rich',
	"auto_save_interval" integer DEFAULT 1000,
	"anthropic_api_key" text,
	"model_preference" varchar(50) DEFAULT 'claude-opus-4-6',
	"temperature" integer DEFAULT 7,
	"max_tokens" integer DEFAULT 4096,
	"extended_thinking" boolean DEFAULT false,
	"email_notifications" boolean DEFAULT true,
	"export_notifications" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "source_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"processing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"processed_at" timestamp,
	"extracted_text" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"author_name" text,
	"page_count" integer,
	"word_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_book_chapters" ADD CONSTRAINT "library_book_chapters_library_book_id_library_books_id_fk" FOREIGN KEY ("library_book_id") REFERENCES "public"."library_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_source_book_id_books_id_fk" FOREIGN KEY ("source_book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outline_items" ADD CONSTRAINT "outline_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_user_id_idx" ON "books" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_book_id_idx" ON "chat_messages" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "chat_messages_starred_idx" ON "chat_messages" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "chat_sessions_book_id_idx" ON "chat_sessions" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_book_chapters_library_book_id_idx" ON "library_book_chapters" USING btree ("library_book_id");--> statement-breakpoint
CREATE INDEX "library_books_author_idx" ON "library_books" USING btree ("author");--> statement-breakpoint
CREATE INDEX "library_books_genre_idx" ON "library_books" USING btree ("genre");--> statement-breakpoint
CREATE INDEX "manuscripts_book_id_idx" ON "manuscripts" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "manuscripts_chapter_id_idx" ON "manuscripts" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "outline_items_book_id_idx" ON "outline_items" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "outline_items_parent_id_idx" ON "outline_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "source_materials_book_id_idx" ON "source_materials" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "source_materials_user_id_idx" ON "source_materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_materials_status_idx" ON "source_materials" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "usage_tracking_user_id_idx" ON "usage_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_tracking_type_idx" ON "usage_tracking" USING btree ("resource_type");