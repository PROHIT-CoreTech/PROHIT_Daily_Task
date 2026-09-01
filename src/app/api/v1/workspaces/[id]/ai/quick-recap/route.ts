import { NextRequest, NextResponse } from "next/server";
import { withEntitlements, withErrorHandling, requireFeature, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { generateQuickRecap, type RecapTask } from "@/lib/ai/client";
import { startOfDay, endOfDay } from "date-fns";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements, userId } = await withEntitlements(id);
    requireFeature(entitlements, "ai_assistant");

    await connectToDatabase();
    const now = new Date();

    const [dueToday, overdue, user] = await Promise.all([
      Task.find({ workspaceId: id, completedAt: { $exists: false }, dueDate: { $gte: startOfDay(now), $lte: endOfDay(now) } })
        .sort({ priority: -1 })
        .limit(20)
        .lean(),
      Task.find({ workspaceId: id, completedAt: { $exists: false }, dueDate: { $lt: startOfDay(now) } })
        .sort({ dueDate: 1 })
        .limit(20)
        .lean(),
      User.findById(userId).lean(),
    ]);

    const tasks: RecapTask[] = [
      ...overdue.map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate?.toISOString(), overdue: true })),
      ...dueToday.map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate?.toISOString(), overdue: false })),
    ];

    const firstName = user?.name.split(" ")[0] ?? "there";

    try {
      const recap = await generateQuickRecap(tasks, firstName);
      return NextResponse.json({ recap });
    } catch (err) {
      console.error("[quick-recap] Anthropic API call failed", err);
      throw new ApiError(502, {
        error: "ai_provider_error",
        message: "Quick Recap couldn't reach the AI provider. Check ANTHROPIC_API_KEY and try again.",
      });
    }
  });
}
