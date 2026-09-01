import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { FocusSession } from "@/models/FocusSession";

const EndSessionSchema = z.object({
  completed: z.boolean(), // true = ran the full planned duration, false = stopped early
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await connectToDatabase();

    const session = await FocusSession.findById(id);
    if (!session) throw new ApiError(404, { error: "not_found", message: "Focus session not found." });

    const { userId } = await withWorkspace(session.workspaceId.toString());
    if (session.userId.toString() !== userId) {
      throw new ApiError(403, { error: "forbidden", message: "Not your focus session." });
    }

    const body = EndSessionSchema.parse(await req.json());
    session.endedAt = new Date();
    session.completed = body.completed;
    await session.save();

    return NextResponse.json({ ok: true });
  });
}
