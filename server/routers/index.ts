import { router } from '../trpc';
import { authRouter } from './auth';
import { booksRouter } from './books';
import { chatRouter } from './chat';
import { filesRouter } from './files';
import { libraryRouter } from './library';
import { subscriptionRouter } from './subscription';

export const appRouter = router({
  auth: authRouter,
  books: booksRouter,
  chat: chatRouter,
  files: filesRouter,
  library: libraryRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
