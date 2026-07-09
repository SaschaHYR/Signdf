import { getDownloadUrl } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const blobUrl = request.nextUrl.searchParams.get("url");
  if (!blobUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const downloadUrl = await getDownloadUrl(blobUrl);
    return NextResponse.redirect(downloadUrl);
  } catch (err) {
    console.error("blob-serve error:", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
