import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../lib/auth';
import type { JWTPayload } from '../lib/auth';

describe('Authentication', () => {
  describe('JWT Tokens', () => {
    const testPayload: JWTPayload = {
      userId: 123,
      openId: 'test-open-id',
      email: 'test@example.com',
      role: 'user',
    };

    it('should create valid JWT token', async () => {
      const token = await signToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify valid token and return payload', async () => {
      const token = await signToken(testPayload);

      const payload = await verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload!.userId).toBe(testPayload.userId);
      expect(payload!.openId).toBe(testPayload.openId);
      expect(payload!.role).toBe(testPayload.role);
    });

    it('should return null for invalid token', async () => {
      const payload = await verifyToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('should return null for tampered token', async () => {
      const token = await signToken(testPayload);

      // Tamper with the payload
      const parts = token.split('.');
      parts[1] = 'tampered';
      const tamperedToken = parts.join('.');

      const payload = await verifyToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it('should include all payload fields', async () => {
      const token = await signToken(testPayload);
      const payload = await verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(123);
      expect(payload!.openId).toBe('test-open-id');
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.role).toBe('user');
    });
  });
});
