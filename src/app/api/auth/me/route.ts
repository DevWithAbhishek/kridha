import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("kridha_access")?.value;
    if (!token) {
      return NextResponse.json({ success: true, data: null });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      roles: string[];
    };

    return NextResponse.json({
      success: true,
      data: {
        userId: payload.userId,
        roles: payload.roles,
      },
    });
  } catch {
    return NextResponse.json({ success: true, data: null });
  }
}
