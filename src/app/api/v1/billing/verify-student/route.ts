import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withErrorHandling, ApiError } from "@/lib/api/middleware";
import { isAcademicEmail, createVerificationToken } from "@/lib/student-verification";
import { sendMail } from "@/lib/mailer";

const VerifySchema = z.object({ collegeEmail: z.string().trim().email() });

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { userId } = await withAuth();
    const body = VerifySchema.parse(await req.json());

    if (!isAcademicEmail(body.collegeEmail)) {
      throw new ApiError(400, {
        error: "not_academic_email",
        message: "Please use a .edu, .ac.in, or .edu.in email address.",
      });
    }

    const token = createVerificationToken(userId, body.collegeEmail);
    const confirmUrl = `${process.env.NEXTAUTH_URL}/api/v1/billing/verify-student/confirm?token=${token}`;

    await sendMail(
      body.collegeEmail,
      "Confirm your student discount — PROHIT Daily Task",
      `<div style="font-family: sans-serif; color: #1B2A4A;">
        <h2>Confirm your student discount</h2>
        <p>Click the link below within 30 minutes to unlock Pro (Student) pricing.</p>
        <p><a href="${confirmUrl}" style="background:#2A9D8F;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Confirm my student email</a></p>
      </div>`
    );

    return NextResponse.json({ ok: true, message: "Verification email sent." });
  });
}
