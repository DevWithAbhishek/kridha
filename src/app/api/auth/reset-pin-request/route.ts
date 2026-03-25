import { handleError } from "@/lib/handleError";
import { ResetPinRequestSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { NextRequest, NextResponse } from "next/server";


export async function resetPinRequest(req:NextRequest) {
    try {
        const body = ResetPinRequestSchema.parse(req.json());
        const result = await authService.resetPinRequest(body);

        return NextResponse.json({ success: true, message: result.message }, { status: 200 });
    } catch (err) {
        handleError(err);
    }
}