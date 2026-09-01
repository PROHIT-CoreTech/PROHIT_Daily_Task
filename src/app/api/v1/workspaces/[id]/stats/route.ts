import { NextRequest, NextResponse } from "next/server";
import { withEntitlements, withErrorHandling } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { subDays, startOfDay, endOfDay, formatISO } from "date-fns";
import { Types } from "mongoose";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements } = await withEntitlements(id);
    await connectToDatabase();

    const [total, completed, overdue] = await Promise.all([
      Task.countDocuments({ workspaceId: id }),
      Task.countDocuments({ workspaceId: id, completedAt: { $exists: true } }),
      Task.countDocuments({ workspaceId: id, completedAt: { $exists: false }, dueDate: { $lt: new Date() } }),
    ]);

    const days = 14;
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const count = await Task.countDocuments({
        workspaceId: id,
        completedAt: { $gte: startOfDay(day), $lte: endOfDay(day) },
      });
      trend.push({ date: formatISO(day, { representation: "date" }), completed: count });
    }

    const response: Record<string, unknown> = {
      totalTasks: total,
      completedTasks: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      overdueTasks: overdue,
      trend,
    };

    if (entitlements.features.team_dashboard) {
      const byAssignee = await Task.aggregate([
        { $match: { workspaceId: new Types.ObjectId(id) } },
        {
          $group: {
            _id: "$assigneeId",
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } },
          },
        },
      ]);
      response.teamBreakdown = byAssignee;
    }

    return NextResponse.json(response);
  });
}
