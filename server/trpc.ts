import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Request, Response } from 'express';
import type { Database } from './db';
import type { JWTPayload } from './lib/auth';

export interface Context {
  req: Request;
  res: Response;
  db: Database;
  user: JWTPayload | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof Error
            ? error.cause.message
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to ensure user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      userId: ctx.user.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware to ensure user is admin
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You must be an admin to perform this action',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      userId: ctx.user.userId,
    },
  });
});

export const adminProcedure = t.procedure.use(isAdmin);
