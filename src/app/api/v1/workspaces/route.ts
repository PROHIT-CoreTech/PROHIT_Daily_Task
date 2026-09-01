import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withErrorHandling } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Workspace } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { List } from "@/models/List";
import { recomputeEntitlements } from "@/lib/entitlements/service";
import { BRAND_COLORS } from "@/lib/constants";

const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["team", "business"]), // "personal" is provisioned automatically at signup only
});

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { userId } = await withAuth();
    const body = CreateWorkspaceSchema.parse(await req.json());
    await connectToDatabase();

    // Team/Business workspaces start on the "team" plan (spec §D1: type and
    // plan are independent axes, but team/business workspaces require a
    // paid per-seat plan from the outset — there's no free multi-member tier).
    const workspace = await Workspace.create({
      name: body.name,
      type: body.type,
      ownerId: userId,
      members: [{ userId, role: "owner", joinedAt: new Date() }],
    });

    await Subscription.create({
      workspaceId: workspace._id,
      plan: "team",
      status: "active",
      seats: 1,
    });

    await List.create({
      workspaceId: workspace._id,
      name: "General",
      color: BRAND_COLORS.primary,
      order: 0,
      createdBy: userId,
    });

    await recomputeEntitlements(workspace._id.toString());

    return NextResponse.json({ id: workspace._id.toString() }, { status: 201 });
  });
}
