import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { List } from "@/lib/models/List";
import { Workspace } from "@/lib/models/Workspace";
import { ApiError, handle, requireLimit, requireWorkspaceCtx } from "@/lib/api/guard";
import { ORDER_GAP } from "@/lib/utils/boardOrder";

type Params = { params: Promise<{ id: string }> };

const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);
    const q = req.nextUrl.searchParams;

    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId };

    // Cast failures here previously threw synchronously and fell through to
    // guard.ts's catch-all as a 500 — every other malformed-input path in
    // this codebase returns 400 validation_failed, so these should too.
    for (const [param, field] of [
      ["listId", "listId"],
      ["assigneeId", "assigneeId"],
    ] as const) {
      const value = q.get(param);
      if (!value) continue;
      if (!Types.ObjectId.isValid(value)) {
        return NextResponse.json({ error: "validation_failed", issues: [`invalid ${param}`] }, { status: 400 });
      }
      filter[field] = new Types.ObjectId(value);
    }

    if (q.get("status")) {
      const status = q.get("status")!;
      if (!["todo", "in_progress", "done"].includes(status)) {
        return NextResponse.json(
          { error: "validation_failed", issues: ["invalid status"] },
          { status: 400 }
        );
      }
      filter.status = status;
    }
    if (q.get("tags")) filter.tags = { $in: q.get("tags")!.split(",") };

    const due: Record<string, Date> = {};
    for (const [param, op] of [
      ["dueAfter", "$gte"],
      ["dueBefore", "$lte"],
    ] as const) {
      const value = q.get(param);
      if (!value) continue;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "validation_failed", issues: [`invalid ${param}`] }, { status: 400 });
      }
      due[op] = parsed;
    }
    if (Object.keys(due).length) filter.dueDate = due;

    if (q.get("q")) {
      // Escaped so a user typing "C++" or "(draft)" does not throw a regex error.
      const escaped = q.get("q")!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }

    // Cursor pagination on _id — stable under concurrent inserts in a way
    // that skip/limit is not.
    const cursor = q.get("cursor");
    if (cursor && Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    await connectDb();
    const tasks = await Task.find(filter)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .lean<{ _id: Types.ObjectId }[]>();

    const hasMore = tasks.length > PAGE_SIZE;
    const page = hasMore ? tasks.slice(0, PAGE_SIZE) : tasks;

    return NextResponse.json({
      tasks: page,
      nextCursor: hasMore ? page[page.length - 1]._id.toString() : null,
    });
  });
}

const CreateTask = z.object({
  listId: z.string().refine(Types.ObjectId.isValid, "invalid listId"),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  assigneeId: z.string().refine(Types.ObjectId.isValid, "invalid assigneeId").optional(),
  recurrence: z
    .object({
      freq: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().int().min(1).max(365).default(1),
      byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
      byMonthDay: z.number().int().min(1).max(31).optional(),
      until: z.string().datetime().optional(),
      count: z.number().int().min(1).optional(),
      completionAnchored: z.boolean().default(false),
    })
    .optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    const parsed = CreateTask.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const body = parsed.data;

    await connectDb();

    const list = await List.findOne({
      _id: body.listId,
      workspaceId: ctx.workspaceId,
    }).lean<{ readOnly?: boolean } | null>();

    if (!list) throw new ApiError(404, { error: "list_not_found" });

    // A list frozen by a downgrade stays readable but accepts no new tasks.
    if (list.readOnly) {
      throw new ApiError(402, {
        error: "list_read_only",
        currentPlan: ctx.entitlements.plan,
        requiredPlan: "pro",
        message: "This list is read-only on your current plan.",
      });
    }

    if (body.assigneeId) {
      const isMember = await Workspace.exists({
        _id: ctx.workspaceId,
        "members.userId": body.assigneeId,
      });
      if (!isMember) throw new ApiError(400, { error: "assignee_not_a_member" });
    }

    const count = await Task.countDocuments({ listId: body.listId });
    requireLimit(ctx, "maxTasksPerList", count);

    const task = await Task.create({
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      recurrence: body.recurrence
        ? { ...body.recurrence, until: body.recurrence.until ? new Date(body.recurrence.until) : undefined }
        : undefined,
      workspaceId: ctx.workspaceId,
      createdBy: ctx.userId,
      boardColumnId: "todo",
      boardOrder: (count + 1) * ORDER_GAP,
    });

    return NextResponse.json({ task }, { status: 201 });
  });
}
