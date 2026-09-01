import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withEntitlements, withErrorHandling, requireLimit } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";

const CreateTaskSchema = z.object({
  listId: z.string(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().trim().max(40)).default([]),
  recurrence: z
    .object({
      freq: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().min(1).default(1),
      byWeekday: z.array(z.number().min(0).max(6)).optional(),
      byMonthDay: z.number().min(1).max(31).optional(),
      until: z.string().datetime().optional(),
      count: z.number().min(1).optional(),
      completionAnchored: z.boolean().default(false),
    })
    .optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await withEntitlements(id);
    await connectToDatabase();

    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");
    const status = url.searchParams.get("status");
    const dueBefore = url.searchParams.get("dueBefore");
    const dueAfter = url.searchParams.get("dueAfter");
    const tags = url.searchParams.getAll("tags");
    const assigneeId = url.searchParams.get("assigneeId");
    const q = url.searchParams.get("q");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const filter: Record<string, unknown> = { workspaceId: id };
    if (listId) filter.listId = listId;
    if (status) filter.status = status;
    if (assigneeId) filter.assigneeId = assigneeId;
    if (tags.length) filter.tags = { $in: tags };
    if (dueBefore || dueAfter) {
      const dueDate: Record<string, Date> = {};
      if (dueBefore) dueDate.$lte = new Date(dueBefore);
      if (dueAfter) dueDate.$gte = new Date(dueAfter);
      filter.dueDate = dueDate;
    }
    if (q) filter.title = { $regex: q, $options: "i" };
    if (cursor) filter._id = { $lt: cursor };

    const tasks = await Task.find(filter).sort({ _id: -1 }).limit(limit).lean();

    return NextResponse.json({
      tasks: tasks.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
      nextCursor: tasks.length === limit ? tasks[tasks.length - 1]._id.toString() : null,
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements, userId } = await withEntitlements(id);
    const body = CreateTaskSchema.parse(await req.json());

    await connectToDatabase();

    const countInList = await Task.countDocuments({ workspaceId: id, listId: body.listId });
    requireLimit(entitlements, "maxTasksPerList", countInList);

    const task = await Task.create({
      workspaceId: id,
      listId: body.listId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      tags: body.tags,
      recurrence: body.recurrence,
      createdBy: userId,
    });

    return NextResponse.json({ id: task._id.toString() }, { status: 201 });
  });
}
