import { describe, it, expect, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth';
import { createToken, verifyToken } from '../lib/jwt';

describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash password consistently', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // With proper salting, hashes should be different
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT Tokens', () => {
    it('should create valid JWT token', async () => {
      const userId = 123;
      const token = await createToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify valid token', async () => {
      const userId = 123;
      const token = await createToken(userId);

      const payload = await verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(userId);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should reject tampered token', async () => {
      const userId = 123;
      const token = await createToken(userId);

      // Tamper with the token
      const parts = token.split('.');
      parts[1] = 'tampered';
      const tamperedToken = parts.join('.');

      await expect(verifyToken(tamperedToken)).rejects.toThrow();
    });
  });
});
