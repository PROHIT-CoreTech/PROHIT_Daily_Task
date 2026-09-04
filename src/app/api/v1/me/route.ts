import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHydration } from "@/lib/queries/hydrate";
import { handle } from "@/lib/api/guard";

/** One call hydrates the whole app shell: user, workspaces, active entitlements. */
export async function GET() {
  return handle(async () => {
    const session = await getServerSession(authOptions);
    const uid = (session?.user as { id?: string } | undefined)?.id;
    if (!uid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const hydration = await getHydration(uid);

    return NextResponse.json(hydration);
  });
}
