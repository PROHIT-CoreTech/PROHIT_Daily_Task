import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { provisionPersonalWorkspace } from "@/lib/onboarding";
import { withErrorHandling, ApiError } from "@/lib/api/middleware";

const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = RegisterSchema.parse(await req.json());
    await connectToDatabase();

    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) {
      throw new ApiError(409, { error: "email_taken", message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
    });

    await provisionPersonalWorkspace(user._id.toString(), user.name);

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
