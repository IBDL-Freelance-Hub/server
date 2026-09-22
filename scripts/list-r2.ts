import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

async function main() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing R2 credentials in .env');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log(`\n📦 Checking Cloudflare R2 Bucket: "${bucket}"`);
  console.log(`🔗 Endpoint: ${endpoint}\n`);

  try {
    const res = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
    const count = res.KeyCount || 0;

    console.log(`Total Objects Found: ${count}\n`);

    if (res.Contents && res.Contents.length > 0) {
      console.log('─────────────────────────────────────────────────────────────');
      console.log('File Key / Path                               │ Size       │ Last Modified');
      console.log('─────────────────────────────────────────────────────────────');
      for (const item of res.Contents) {
        const sizeKb = ((item.Size || 0) / 1024).toFixed(1) + ' KB';
        const date = item.LastModified ? item.LastModified.toISOString() : 'N/A';
        console.log(`${(item.Key || '').padEnd(45)} │ ${sizeKb.padEnd(10)} │ ${date}`);
      }
      console.log('─────────────────────────────────────────────────────────────\n');
    } else {
      console.log('ℹ️  The bucket is currently empty.\n');
    }
  } catch (err: unknown) {
    console.error('❌ Failed to connect to R2:', err instanceof Error ? err.message : err);
  }
}

main();
