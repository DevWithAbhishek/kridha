import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getUser } from "@/lib/get-user";
import { timeStamp } from "console";
import { handleError } from "@/lib/handleError";
// Returns a Cloudinary signed upload params — file goes directly from client
// to Cloudinary. Never passes through Kridha server. API secret never leaves.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const { folder = "products" } = await req.json().catch(() => ({}));

    const allowedFolders = ["products", "profiles", "stores"];
    const safeFolder = allowedFolders.includes(folder) ? folder : "products";

    const timestamp = Math.round(Date.now() / 1000);
    const params = { timeStamp, folder: `kridha/${safeFolder}` };
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!,
    );

    return NextResponse.json({
      success: true,
      data: {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: `kridha/${safeFolder}`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
