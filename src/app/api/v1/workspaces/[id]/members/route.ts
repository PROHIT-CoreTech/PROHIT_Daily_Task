import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, requireLimit, forbidden, ApiError } from "@/lib/api/middleware";
import { getEntitlements } from "@/lib/entitlements/service";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

const AddMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { workspace, role } = await withWorkspace(id);
    if (role !== "owner" && role !== "admin") throw forbidden("Only owners and admins can add members.");
    if (workspace.type === "personal") throw forbidden("Personal workspaces cannot have members.");

    const body = AddMemberSchema.parse(await req.json());
    const entitlements = await getEntitlements(id);
    requireLimit(entitlements, "maxMembers", workspace.members.length);

    await connectToDatabase();
    const invitee = await User.findOne({ email: body.email.toLowerCase() });
    if (!invitee) {
      throw new ApiError(404, { error: "user_not_found", message: "No account with that email exists yet." });
    }

    const alreadyMember = workspace.members.some((m) => m.userId.toString() === invitee._id.toString());
    if (alreadyMember) throw new ApiError(409, { error: "already_member", message: "Already a member." });

    workspace.members.push({ userId: invitee._id, role: body.role, joinedAt: new Date() });
    await workspace.save();

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
