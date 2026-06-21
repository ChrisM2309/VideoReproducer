import { NextResponse } from "next/server";
import { getDriveAccessToken, getDriveFileMetadata } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildHeaders(source: Headers, fallbackMimeType: string | null) {
  const headers = new Headers();

  const contentType = source.get("content-type") ?? fallbackMimeType;
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  for (const key of [
    "accept-ranges",
    "content-length",
    "content-range",
    "etag",
    "last-modified",
  ]) {
    const value = source.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  headers.set("Cache-Control", "private, max-age=60");

  return headers;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;

  try {
    const [accessToken, metadata] = await Promise.all([
      getDriveAccessToken(),
      getDriveFileMetadata(fileId),
    ]);

    const upstreamHeaders = new Headers({
      Authorization: `Bearer ${accessToken}`,
    });

    const range = request.headers.get("range");
    if (range) {
      upstreamHeaders.set("Range", range);
    }

    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: upstreamHeaders,
        cache: "no-store",
      },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            "No fue posible descargar el archivo desde Google Drive para reproducirlo.",
        },
        { status: upstream.status },
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: buildHeaders(upstream.headers, metadata.mimeType ?? null),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible preparar el archivo solicitado.",
      },
      { status: 502 },
    );
  }
}
