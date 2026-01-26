import { router } from '../trpc';
import { authRouter } from './auth';
import { booksRouter } from './books';
import { chatRouter } from './chat';
import { filesRouter } from './files';

export const appRouter = router({
  auth: authRouter,
  books: booksRouter,
  chat: chatRouter,
  files: filesRouter,
});

export type AppRouter = typeof appRouter;
