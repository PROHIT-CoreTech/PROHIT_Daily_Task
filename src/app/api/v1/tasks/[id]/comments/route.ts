import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";
import { connectToDatabase } from "@/lib/db";
import { Comment } from "@/models/Comment";

const CreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await loadAuthorizedTask(id);
    await connectToDatabase();

    const comments = await Comment.find({ taskId: id }).sort({ createdAt: 1 }).lean();
    return NextResponse.json({
      comments: comments.map((c) => ({ ...c, id: c._id.toString(), _id: undefined })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task, userId } = await loadAuthorizedTask(id);
    const body = CreateCommentSchema.parse(await req.json());

    await connectToDatabase();
    const comment = await Comment.create({
      taskId: id,
      workspaceId: task.workspaceId,
      authorId: userId,
      body: body.body,
    });

    return NextResponse.json({ id: comment._id.toString() }, { status: 201 });
  });
}
