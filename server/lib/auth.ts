import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key'
);

export interface JWTPayload {
  userId: number;
  openId: string;
  email?: string;
  role: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;

  const token = authHeader?.replace('Bearer ', '') || cookieToken;

  if (!token) {
    req.user = null;
    return next();
  }

  const payload = await verifyToken(token);
  req.user = payload;
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user: JWTPayload | null;
    }
  }
}
