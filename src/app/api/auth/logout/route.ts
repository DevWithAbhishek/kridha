import { clearAuthCookies } from "@/lib/cookies";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { NextRequest, NextResponse } from "next/server";


export async function POST(req: NextRequest) {
    try {
        const rawToken = req.cookies.get('kridha_refresh')?.value;

        if (rawToken) await tokenService.revokeOne(rawToken);

        const response = NextResponse.json({ success: true, message: "Logged out successfully" }, { status: 200 });
        clearAuthCookies(response);

        return response;
    } catch (err) {
        handleError(err);
    }
}