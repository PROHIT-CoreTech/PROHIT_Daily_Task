import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes to click the email link
const VERIFICATION_VALID_MS = 365 * 24 * 60 * 60 * 1000; // re-verify annually (spec §1.1)

export const STUDENT_VERIFICATION_VALID_MS = VERIFICATION_VALID_MS;

// Accept common Indian and generic academic domains. Not exhaustive by
// design — this is a soft gate, not a security boundary; the real check is
// "can this person receive mail at a .edu/.ac.in address".
const ACADEMIC_DOMAIN_PATTERN = /\.(edu|ac\.in|edu\.in)$/i;

export function isAcademicEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return ACADEMIC_DOMAIN_PATTERN.test(domain);
}

export function createVerificationToken(userId: string, collegeEmail: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${collegeEmail}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyVerificationToken(token: string): { userId: string; collegeEmail: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, collegeEmail, expiresAtStr, signature] = decoded.split(":");
    const payload = `${userId}:${collegeEmail}:${expiresAtStr}`;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature ?? "");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;
    if (Date.now() > Number(expiresAtStr)) return null;

    return { userId, collegeEmail };
  } catch {
    return null;
  }
}
