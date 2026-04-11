import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pincode = searchParams.get("pincode");

  // Validate input
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }
  try {
    // External API call
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    const postOffice = data?.[0]?.PostOffice?.[0];
    if (!postOffice) {
      return NextResponse.json({ error: "Pincode not found" }, { status: 404 });
    }
    return NextResponse.json({
      city: postOffice.District,
      state: postOffice.State,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch pincode data" },
      { status: 500 },
    );
  }
}
