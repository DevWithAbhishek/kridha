import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { SignupSchema } from "@/schemas";
import { authService } from "@/services/auth.service";

export async function POST(req: NextRequest) {
    try {
        const body = SignupSchema.parse(await req.json());
        const result = await authService.signup(body);
        return NextResponse.json({ success: true, message: result.message }, { status: 201 });
    } catch (err) {
        return handleError(err);
    }
}