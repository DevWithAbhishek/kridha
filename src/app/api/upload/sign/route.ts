// src/app/api/upload/sign/route.ts
// Returns signed Cloudinary params. File goes browser → Cloudinary directly.
// API secret never leaves the server.

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    console.log("Call received");
    getUser(req); // must be logged in — no anonymous uploads

    console.log("User authenticated");
    const { folder = "products" } = await req.json().catch(() => ({}));
    const allowedFolders = ["products", "profiles", "stores"] as const;
    const safeFolder = (allowedFolders as readonly string[]).includes(folder)
      ? folder
      : "products";

    // FIX 1: was `timeStamp` (console.timeStamp ref) — must be `timestamp`
    const timestamp = Math.round(Date.now() / 1000);

    // FIX 2: params object must use `timestamp` key matching the variable
    const params = { timestamp, folder: `kridha/${safeFolder}` };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!,
    );
    console.log("Everything is ok");

    return NextResponse.json({
      success: true,
      data: {
        signature,
        timestamp, // FIX 3: was timestamp but params used timeStamp — now consistent
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: `kridha/${safeFolder}`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
