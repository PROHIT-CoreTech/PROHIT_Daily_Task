import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the Google consent flow

/**
 * Signs {userId, workspaceId} into the OAuth `state` param so the callback
 * can trust it without a server-side session lookup mid-redirect, and so a
 * forged callback (CSRF) can't connect a calendar to someone else's
 * workspace. Same signed-token pattern as student-verification.ts.
 */
export function createOAuthState(userId: string, workspaceId: string): string {
  const expiresAt = Date.now() + STATE_TTL_MS;
  const payload = `${userId}:${workspaceId}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyOAuthState(state: string): { userId: string; workspaceId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [userId, workspaceId, expiresAtStr, signature] = decoded.split(":");
    const payload = `${userId}:${workspaceId}:${expiresAtStr}`;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature ?? "");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;
    if (Date.now() > Number(expiresAtStr)) return null;

    return { userId, workspaceId };
  } catch {
    return null;
  }
}
