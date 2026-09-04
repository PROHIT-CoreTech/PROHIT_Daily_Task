import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { List } from "@/lib/models/List";
import { handle, requireLimit, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    await connectDb();
    const lists = await List.find({
      workspaceId: ctx.workspaceId,
      archivedAt: { $exists: false },
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ lists });
  });
}

const CreateList = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    const parsed = CreateList.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await connectDb();

    // Archived lists do not count — that is the escape hatch for a Free user
    // at their cap who does not want to delete history.
    const current = await List.countDocuments({
      workspaceId: ctx.workspaceId,
      archivedAt: { $exists: false },
    });
    requireLimit(ctx, "maxLists", current);

    const list = await List.create({
      ...parsed.data,
      workspaceId: ctx.workspaceId,
      createdBy: ctx.userId,
      order: current,
    });

    return NextResponse.json({ list }, { status: 201 });
  });
}
