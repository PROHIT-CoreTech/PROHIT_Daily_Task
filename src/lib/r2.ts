import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const BUCKET = process.env.R2_BUCKET_NAME ?? "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

/** Returns a presigned PUT URL the client uploads directly to, plus the public URL to store on the task. */
export async function createUploadUrl(workspaceId: string, filename: string, contentType: string) {
  const key = `${workspaceId}/${randomUUID()}-${filename}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { uploadUrl, publicUrl, key };
}

export async function deleteObject(key: string) {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
