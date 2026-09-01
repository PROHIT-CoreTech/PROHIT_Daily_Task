import { NextRequest, NextResponse } from "next/server";
import { withEntitlements, withErrorHandling } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await withEntitlements(id);
    await connectToDatabase();

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [dueToday, overdue, completedToday, totalActive] = await Promise.all([
      Task.find({
        workspaceId: id,
        completedAt: { $exists: false },
        dueDate: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ priority: -1, dueDate: 1 })
        .lean(),
      Task.find({
        workspaceId: id,
        completedAt: { $exists: false },
        dueDate: { $lt: todayStart },
      })
        .sort({ dueDate: 1 })
        .lean(),
      Task.countDocuments({ workspaceId: id, completedAt: { $gte: todayStart, $lte: todayEnd } }),
      Task.countDocuments({
        workspaceId: id,
        $or: [{ completedAt: { $exists: false } }, { completedAt: { $gte: todayStart, $lte: todayEnd } }],
        dueDate: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

    return NextResponse.json({
      dueToday: dueToday.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
      overdue: overdue.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
      completedToday,
      totalToday: totalActive,
    });
  });
}
