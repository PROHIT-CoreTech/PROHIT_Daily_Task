import { NextRequest, NextResponse } from "next/server";
import { verifyVerificationToken, STUDENT_VERIFICATION_VALID_MS } from "@/lib/student-verification";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  const result = token ? verifyVerificationToken(token) : null;

  const appUrl = process.env.NEXTAUTH_URL ?? "";

  if (!result) {
    return NextResponse.redirect(`${appUrl}/settings/billing?studentVerification=invalid`);
  }

  await connectToDatabase();
  await User.findByIdAndUpdate(result.userId, {
    studentVerification: {
      collegeEmail: result.collegeEmail,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + STUDENT_VERIFICATION_VALID_MS),
    },
  });

  return NextResponse.redirect(`${appUrl}/settings/billing?studentVerification=success`);
}
