import { NextRequest, NextResponse } from "next/server";
import { getCalendar, getWeekStartsOn } from "@/lib/queries/calendar";
import { handle, requireFeature, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    const view = req.nextUrl.searchParams.get("view") === "week" ? "week" : "month";
    // Free gets month only (BRD 9.1: "month-view calendar only").
    if (view === "week") requireFeature(ctx, "calendar_week_view");

    const dateParam = req.nextUrl.searchParams.get("date");
    const anchor = dateParam && !Number.isNaN(Date.parse(dateParam)) ? new Date(dateParam) : new Date();

    const weekStartsOn = await getWeekStartsOn(id);
    const days = await getCalendar(id, view, anchor, weekStartsOn);

    return NextResponse.json({ view, days });
  });
}
