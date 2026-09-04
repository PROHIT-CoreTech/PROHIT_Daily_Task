"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { InviteInfo } from "@/lib/queries/invite";

export function InviteAcceptView({
  token,
  invite,
  sessionEmail,
}: {
  token: string;
  invite: InviteInfo | null;
  sessionEmail: string | null;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setAccepting(true);
    setError(null);
    const res = await fetch(`/api/v1/invites/${token}/accept`, { method: "POST" });
    setAccepting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "invite_expired"
          ? "This invite has expired."
          : body.error === "invite_already_used"
            ? "This invite has already been used."
            : "Couldn't accept the invite."
      );
      return;
    }

    router.push("/my-day");
  }

  let body: React.ReactNode;

  if (!invite) {
    body = <p className="text-sm text-muted-foreground">This invite link is invalid.</p>;
  } else if (invite.status === "revoked") {
    body = <p className="text-sm text-muted-foreground">This invite has been revoked.</p>;
  } else if (invite.status === "accepted") {
    body = <p className="text-sm text-muted-foreground">This invite has already been accepted.</p>;
  } else if (invite.expired) {
    body = (
      <p className="text-sm text-muted-foreground">
        This invite has expired. Ask whoever invited you to send a new one.
      </p>
    );
  } else if (!sessionEmail) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Sign in as <span className="font-medium text-foreground">{invite.email}</span> to accept.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  } else if (sessionEmail.toLowerCase() !== invite.email.toLowerCase()) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as {sessionEmail}, but this invite is for{" "}
          <span className="font-medium text-foreground">{invite.email}</span>.
        </p>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out and use a different email
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <Button onClick={accept} disabled={accepting}>
          {accepting ? "Joining…" : `Join as ${invite.role}`}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {invite && !invite.expired && invite.status === "pending"
              ? `Join ${invite.workspaceName}`
              : "Invite"}
          </CardTitle>
          {invite && !invite.expired && invite.status === "pending" && (
            <CardDescription>You&apos;ve been invited on PROHIT Daily Task.</CardDescription>
          )}
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </main>
  );
}
