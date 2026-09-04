import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { Subscription } from "@/lib/models/Subscription";
import { recomputeEntitlements } from "@/lib/entitlements/compute";
import { handle } from "@/lib/api/guard";

const CreateWorkspace = z.object({
  name: z.string().min(1).max(80),
  // Fixed at creation. Converting a personal workspace to business later
  // would change member caps and module eligibility mid-billing-cycle.
  type: z.enum(["personal", "team", "business"]),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await getServerSession(authOptions);
    const uid = (session?.user as { id?: string } | undefined)?.id;
    if (!uid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const parsed = CreateWorkspace.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const userId = new Types.ObjectId(uid);
    await connectDb();

    const workspace = await Workspace.create({
      ...parsed.data,
      ownerId: userId,
      members: [{ userId, role: "owner", joinedAt: new Date() }],
    });

    // Every workspace gets a free subscription row immediately. There is no
    // "no subscription" state, which removes a class of null handling from
    // the gating path.
    await Subscription.create({
      workspaceId: workspace._id,
      plan: "free",
      status: "active",
      seats: 1,
    });

    const entitlements = await recomputeEntitlements(workspace._id);

    return NextResponse.json({ workspace, entitlements }, { status: 201 });
  });
}
