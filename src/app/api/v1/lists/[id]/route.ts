import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { List } from "@/models/List";

const PatchListSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  order: z.number().optional(),
  archived: z.boolean().optional(),
});

async function loadList(id: string) {
  await connectToDatabase();
  const list = await List.findById(id);
  if (!list) throw new ApiError(404, { error: "not_found", message: "List not found." });
  return list;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const list = await loadList(id);
    await withWorkspace(list.workspaceId.toString());

    const body = PatchListSchema.parse(await req.json());
    if (body.name !== undefined) list.name = body.name;
    if (body.color !== undefined) list.color = body.color;
    if (body.icon !== undefined) list.icon = body.icon;
    if (body.order !== undefined) list.order = body.order;
    if (body.archived !== undefined) list.archivedAt = body.archived ? new Date() : undefined;
    await list.save();

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const list = await loadList(id);
    await withWorkspace(list.workspaceId.toString());

    list.archivedAt = new Date();
    await list.save();

    return NextResponse.json({ ok: true });
  });
}
