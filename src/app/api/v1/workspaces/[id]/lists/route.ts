import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withEntitlements, withErrorHandling, requireLimit } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { List } from "@/models/List";
import { BRAND_COLORS } from "@/lib/constants";

const CreateListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().default(BRAND_COLORS.accent),
  icon: z.string().trim().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await withEntitlements(id);
    await connectToDatabase();

    const lists = await List.find({ workspaceId: id, archivedAt: { $exists: false } }).sort({ order: 1 }).lean();
    return NextResponse.json({
      lists: lists.map((l) => ({ ...l, id: l._id.toString(), _id: undefined })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements, userId } = await withEntitlements(id);
    const body = CreateListSchema.parse(await req.json());

    await connectToDatabase();
    const activeCount = await List.countDocuments({ workspaceId: id, archivedAt: { $exists: false } });
    requireLimit(entitlements, "maxLists", activeCount);

    const maxOrder = await List.find({ workspaceId: id }).sort({ order: -1 }).limit(1).lean();
    const order = (maxOrder[0]?.order ?? -1) + 1;

    const list = await List.create({
      workspaceId: id,
      name: body.name,
      color: body.color,
      icon: body.icon,
      order,
      createdBy: userId,
    });

    return NextResponse.json({ id: list._id.toString() }, { status: 201 });
  });
}
