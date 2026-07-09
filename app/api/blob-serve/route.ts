import { getDownloadUrl } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }

  try {
    const url = await getDownloadUrl(pathname);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
