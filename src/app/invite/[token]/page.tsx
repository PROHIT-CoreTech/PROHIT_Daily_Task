import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInviteInfo } from "@/lib/queries/invite";
import { InviteAcceptView } from "@/components/app/invite-accept-view";

type Params = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Params) {
  const { token } = await params;
  const invite = await getInviteInfo(token);
  const session = await getServerSession(authOptions);
  const sessionEmail = (session?.user as { email?: string } | undefined)?.email ?? null;

  return <InviteAcceptView token={token} invite={invite} sessionEmail={sessionEmail} />;
}
