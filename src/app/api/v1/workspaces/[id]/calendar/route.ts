import { NextRequest, NextResponse } from "next/server";
import { withEntitlements, withErrorHandling, requireFeature } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements } = await withEntitlements(id);

    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "month";
    const anchor = url.searchParams.get("date") ? new Date(url.searchParams.get("date") as string) : new Date();

    if (view === "week") requireFeature(entitlements, "calendar_week_view");

    const [rangeStart, rangeEnd] =
      view === "week"
        ? [startOfWeek(anchor, { weekStartsOn: 1 }), endOfWeek(anchor, { weekStartsOn: 1 })]
        : [startOfMonth(anchor), endOfMonth(anchor)];

    await connectToDatabase();
    const tasks = await Task.find({
      workspaceId: id,
      dueDate: { $gte: rangeStart, $lte: rangeEnd },
    })
      .sort({ dueDate: 1 })
      .lean();

    return NextResponse.json({
      view,
      rangeStart,
      rangeEnd,
      tasks: tasks.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
    });
  });
}
