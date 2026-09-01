import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withEntitlements, withErrorHandling, requireFeature } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { FocusSession } from "@/models/FocusSession";
import { startOfDay, endOfDay } from "date-fns";

const StartSessionSchema = z.object({
  plannedMinutes: z.number().min(1).max(180),
  taskId: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements, userId } = await withEntitlements(id);
    requireFeature(entitlements, "deep_work");

    await connectToDatabase();
    const now = new Date();
    const [todaysSessions, recent] = await Promise.all([
      FocusSession.countDocuments({
        workspaceId: id,
        userId,
        completed: true,
        startedAt: { $gte: startOfDay(now), $lte: endOfDay(now) },
      }),
      FocusSession.find({ workspaceId: id, userId }).sort({ startedAt: -1 }).limit(10).lean(),
    ]);

    return NextResponse.json({
      sessionsToday: todaysSessions,
      recent: recent.map((s) => ({ ...s, id: s._id.toString(), _id: undefined })),
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements, userId } = await withEntitlements(id);
    requireFeature(entitlements, "deep_work");

    const body = StartSessionSchema.parse(await req.json());
    await connectToDatabase();

    const session = await FocusSession.create({
      workspaceId: id,
      userId,
      taskId: body.taskId,
      plannedMinutes: body.plannedMinutes,
      startedAt: new Date(),
    });

    return NextResponse.json({ id: session._id.toString() }, { status: 201 });
  });
}
