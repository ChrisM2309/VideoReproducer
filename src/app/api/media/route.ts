import { NextResponse } from "next/server";
import { appConfig, publicAppConfig } from "@/lib/app-config";
import { listFolderFiles } from "@/lib/google-drive";
import { type MediaItem, normalizeDriveFile, sortMediaByName } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado al consultar Google Drive.";
}

export async function GET() {
  if (!appConfig.folderId) {
    return NextResponse.json(
      {
        error:
          "No se ha configurado la carpeta de Google Drive. Define GOOGLE_DRIVE_FOLDER_ID en el entorno.",
      },
      { status: 500 },
    );
  }

  try {
    const files = await listFolderFiles(appConfig.folderId);
    const items = sortMediaByName(
      files
        .map((file) => normalizeDriveFile(file))
        .filter((item): item is MediaItem => item !== null),
    );

    return NextResponse.json(
      {
        items,
        fetchedAt: new Date().toISOString(),
        config: publicAppConfig,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 502 },
    );
  }
}
