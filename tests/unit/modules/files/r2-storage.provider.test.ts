import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  R2StorageProvider,
  R2Config,
} from '../../../../src/modules/files/infrastructure/r2-storage.provider';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('R2StorageProvider Unit Tests', () => {
  let mockS3Client: jest.Mocked<S3Client>;
  let provider: R2StorageProvider;

  const mockConfig: R2Config = {
    accountId: 'test-account-id',
    accessKeyId: 'test-access-key-id',
    secretAccessKey: 'test-secret-access-key',
    bucketName: 'test-r2-bucket',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<S3Client>;

    provider = new R2StorageProvider(mockConfig, mockS3Client);
  });

  it('should upload file buffer to R2 bucket via PutObjectCommand', async () => {
    const buffer = Buffer.from('test r2 content');
    const key = 'test-file-key.pdf';
    const mimeType = 'application/pdf';

    const result = await provider.save(buffer, key, mimeType);

    expect(result).toBe(key);
    expect(mockS3Client.send).toHaveBeenCalledTimes(1);

    const sentCommand = (mockS3Client.send as jest.Mock).mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(PutObjectCommand);
    expect(sentCommand.input).toEqual({
      Bucket: 'test-r2-bucket',
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
  });

  it('should generate a presigned download URL with default 900-second expiry', async () => {
    const mockPresignedUrl =
      'https://test-account-id.r2.cloudflarestorage.com/test-r2-bucket/file.pdf?X-Amz-Signature=xyz';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockPresignedUrl);

    const key = 'file.pdf';
    const signedUrl = await provider.getSignedDownloadUrl(key);

    expect(signedUrl).toBe(mockPresignedUrl);
    expect(getSignedUrl).toHaveBeenCalledWith(mockS3Client, expect.any(GetObjectCommand), {
      expiresIn: 900,
    });

    const commandArg = (getSignedUrl as jest.Mock).mock.calls[0][1];
    expect(commandArg.input).toEqual({
      Bucket: 'test-r2-bucket',
      Key: key,
    });
  });

  it('should generate a presigned download URL with custom expiry if provided', async () => {
    const mockPresignedUrl = 'https://test-r2.com/file.pdf?signature';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockPresignedUrl);

    await provider.getSignedDownloadUrl('file.pdf', 300);

    expect(getSignedUrl).toHaveBeenCalledWith(mockS3Client, expect.any(GetObjectCommand), {
      expiresIn: 300,
    });
  });

  it('should delete object from R2 bucket via DeleteObjectCommand', async () => {
    const key = 'file-to-delete.pdf';
    await provider.delete(key);

    expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    const sentCommand = (mockS3Client.send as jest.Mock).mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(DeleteObjectCommand);
    expect(sentCommand.input).toEqual({
      Bucket: 'test-r2-bucket',
      Key: key,
    });
  });

  it('should construct S3Client with custom endpoint if provided in config', () => {
    const customConfig: R2Config = {
      ...mockConfig,
      endpoint: 'https://custom-r2-endpoint.internal',
    };

    const customProvider = new R2StorageProvider(customConfig);
    expect(customProvider).toBeDefined();
  });
});
