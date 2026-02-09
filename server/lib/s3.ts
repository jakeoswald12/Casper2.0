import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    }),
    { expiresIn }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    })
  );
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string) {
  return s3Client.send(
    new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    })
  );
}

export function generateStoragePath(
  userId: number,
  bookId: number,
  filename: string
): string {
  const ext = filename.split('.').pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return `sources/${userId}/${bookId}/${uniqueId}.${ext}`;
}
