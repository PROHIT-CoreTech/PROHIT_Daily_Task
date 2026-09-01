import { NextResponse } from "next/server";
import { withAuth, withErrorHandling } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Workspace } from "@/models/Workspace";
import { getEntitlements } from "@/lib/entitlements/service";

export async function GET() {
  return withErrorHandling(async () => {
    const { userId } = await withAuth();
    await connectToDatabase();

    const [user, workspaces] = await Promise.all([
      User.findById(userId).lean(),
      Workspace.find({ "members.userId": userId }).lean(),
    ]);

    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const workspacesWithEntitlements = await Promise.all(
      workspaces.map(async (ws) => ({
        id: ws._id.toString(),
        name: ws.name,
        type: ws.type,
        role: ws.members.find((m) => m.userId.toString() === userId)?.role,
        entitlements: await getEntitlements(ws._id.toString()),
      }))
    );

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        defaultWorkspaceId: user.defaultWorkspaceId?.toString(),
        isStudentVerified: Boolean(
          user.studentVerification && new Date(user.studentVerification.expiresAt) > new Date()
        ),
      },
      workspaces: workspacesWithEntitlements,
    });
  });
}
