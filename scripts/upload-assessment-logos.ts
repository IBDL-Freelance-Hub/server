import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function main() {
  const bucketName = process.env.R2_BUCKET_NAME || 'freelancers-hub';
  const endpoint =
    process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });

  const assetsDir = path.resolve(__dirname, '../src/shared/assets/assessments');
  const filesToUpload = [
    { file: 'pqp.png', key: 'hub/assessments/pqp.png', contentType: 'image/png' },
    { file: 'cpat.png', key: 'hub/assessments/cpat.png', contentType: 'image/png' },
    {
      file: 'management-drives.png',
      key: 'hub/assessments/management-drives.png',
      contentType: 'image/png',
    },
  ];

  console.log(`🚀 Uploading assessment logos to Cloudflare R2 (${bucketName})...`);

  for (const item of filesToUpload) {
    const filePath = path.join(assetsDir, item.file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: item.key,
        Body: buffer,
        ContentType: item.contentType,
      }),
    );

    console.log(`✅ Uploaded: ${item.key} (${buffer.length} bytes)`);
  }

  console.log('🎉 Assessment logos uploaded successfully to Cloudflare R2!');
}

main().catch(console.error);
