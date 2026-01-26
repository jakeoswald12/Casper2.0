import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/casper_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'test-message-id',
        content: [{ type: 'text', text: 'Test response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

// Mock S3 client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://test-presigned-url.com'),
}));
