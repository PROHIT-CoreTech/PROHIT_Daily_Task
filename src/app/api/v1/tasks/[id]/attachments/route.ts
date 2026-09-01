import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling, requireFeature, ApiError } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";
import { getEntitlements } from "@/lib/entitlements/service";
import { createUploadUrl } from "@/lib/r2";

const RequestUploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().min(1),
});

/**
 * Two-step upload: client asks for a presigned URL, uploads directly to
 * R2, then the record is saved on the task. This endpoint does the first
 * step and pre-registers the attachment metadata; the client PUTs to
 * `uploadUrl` itself.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task, userId } = await loadAuthorizedTask(id);
    const body = RequestUploadSchema.parse(await req.json());

    const entitlements = await getEntitlements(task.workspaceId.toString());
    requireFeature(entitlements, "unlimited_attachments");

    const maxBytes = entitlements.limits.maxAttachmentMb * 1024 * 1024;
    if (body.sizeBytes > maxBytes) {
      throw new ApiError(402, {
        error: "limit_exceeded",
        limit: "maxAttachmentMb",
        max: entitlements.limits.maxAttachmentMb,
        currentPlan: entitlements.plan,
      });
    }

    const { uploadUrl, publicUrl } = await createUploadUrl(task.workspaceId.toString(), body.filename, body.contentType);

    task.attachments.push({
      filename: body.filename,
      url: publicUrl,
      sizeBytes: body.sizeBytes,
      uploadedBy: userId as unknown as typeof task.createdBy,
      uploadedAt: new Date(),
    });
    await task.save();

    return NextResponse.json({ uploadUrl, publicUrl }, { status: 201 });
  });
}
