import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      token: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 50 * 1024 * 1024,
        pathname,
        access: "public",
      }),
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
