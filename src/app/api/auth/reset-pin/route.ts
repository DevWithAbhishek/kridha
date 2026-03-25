import { handleError } from "@/lib/handleError";
import { ResetPinSchema } from "@/schemas"
import { authService } from "@/services/auth.service";
import { NextRequest, NextResponse } from "next/server"


export async function POST (req: NextRequest){
    try {
        const body = ResetPinSchema.parse(req.json());
        const result = await authService.resetPin(body);

        // ideally - cookies will be cleared, new cookies will be set
        return NextResponse.json({ success: true, message: result.message }, { status: 200 });
    } catch (err) {
        handleError(err);
    }
}