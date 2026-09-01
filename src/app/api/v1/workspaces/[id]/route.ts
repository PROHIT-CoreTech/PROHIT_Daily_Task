import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, forbidden } from "@/lib/api/middleware";

const PatchWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  settings: z
    .object({
      weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
      defaultView: z.enum(["my_day", "calendar", "flow_board"]).optional(),
    })
    .optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { workspace, role } = await withWorkspace(id);
    return NextResponse.json({
      id: workspace._id.toString(),
      name: workspace.name,
      type: workspace.type,
      role,
      settings: workspace.settings,
      members: workspace.members,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { workspace, role } = await withWorkspace(id);
    if (role !== "owner" && role !== "admin") throw forbidden("Only owners and admins can edit this workspace.");

    const body = PatchWorkspaceSchema.parse(await req.json());
    if (body.name) workspace.name = body.name;
    workspace.settings ??= { weekStartsOn: 1, defaultView: "my_day" };
    if (body.settings?.weekStartsOn !== undefined) workspace.settings.weekStartsOn = body.settings.weekStartsOn;
    if (body.settings?.defaultView !== undefined) workspace.settings.defaultView = body.settings.defaultView;
    await workspace.save();

    return NextResponse.json({ ok: true });
  });
}
