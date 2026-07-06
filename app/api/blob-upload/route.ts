import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const pathname = searchParams.get("pathname");

  if (!pathname) {
    return NextResponse.json({ error: "pathname required" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "application/pdf";
  const body = await req.arrayBuffer();

  const { url } = await put(pathname, body, {
    access: "public",
    contentType,
  });

  return NextResponse.json({ url });
}
