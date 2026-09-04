import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { List } from "@/lib/models/List";
import { ApiError, handle, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

async function loadListAndAuthorize(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, { error: "invalid_list_id" });

  await connectDb();
  const list = await List.findById(id).lean<{ workspaceId: Types.ObjectId } | null>();
  if (!list) throw new ApiError(404, { error: "list_not_found" });

  await requireWorkspaceCtx(list.workspaceId.toString());
  return list;
}

const UpdateList = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(40).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await loadListAndAuthorize(id);

    const parsed = UpdateList.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await List.updateOne({ _id: id }, { $set: parsed.data });
    const list = await List.findById(id).lean();

    return NextResponse.json({ list });
  });
}

/**
 * Archives, never deletes — same rule as a downgrade freeze (README's
 * "Downgrade freezes, never deletes"). Idempotent: archiving an
 * already-archived list is a no-op, not an error.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await loadListAndAuthorize(id);

    await List.updateOne(
      { _id: id, archivedAt: { $exists: false } },
      { $set: { archivedAt: new Date() } }
    );

    return NextResponse.json({ ok: true });
  });
}
