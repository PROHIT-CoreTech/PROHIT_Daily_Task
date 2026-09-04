import { NextRequest, NextResponse } from "next/server";
import { getMyDay } from "@/lib/queries/myDay";
import { handle, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    const myDay = await getMyDay(ctx.workspaceId);

    return NextResponse.json(myDay);
  });
}
