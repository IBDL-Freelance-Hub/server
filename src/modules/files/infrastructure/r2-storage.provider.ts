import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageProvider,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
} from '../domain/storage-provider.interface';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: R2Config, clientOverride?: S3Client) {
    this.bucketName = config.bucketName;

    if (clientOverride) {
      this.client = clientOverride;
    } else {
      const endpoint = config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;

      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }
  }

  /**
   * Persists a file buffer directly to Cloudflare R2 bucket.
   */
  async save(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.client.send(command);
    return key;
  }

  /**
   * Generates a temporary, time-limited presigned download URL directly from R2.
   * Defaults to 900 seconds (15 minutes).
   */
  async getSignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Deletes an object from the R2 bucket.
   */
  async delete(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    await this.client.send(command);
  }
}
