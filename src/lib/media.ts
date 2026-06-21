export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  kind: MediaKind;
  extension: string;
  modifiedTime: string | null;
  size: number | null;
  contentUrl: string;
}

export interface DriveFileLike {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  fileExtension?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
}

const IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

export function normalizeDriveFile(file: DriveFileLike): MediaItem | null {
  const id = file.id?.trim();
  const name = file.name?.trim();
  const mimeType = file.mimeType?.toLowerCase().trim();

  if (!id || !name || !mimeType) {
    return null;
  }

  let kind: MediaKind | null = null;

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    kind = "image";
  }

  if (VIDEO_MIME_TYPES.has(mimeType)) {
    kind = "video";
  }

  if (!kind) {
    return null;
  }

  const extension = (
    file.fileExtension?.toLowerCase() ??
    name.split(".").pop()?.toLowerCase() ??
    ""
  ).trim();

  return {
    id,
    name,
    mimeType,
    kind,
    extension,
    modifiedTime: file.modifiedTime ?? null,
    size: file.size ? Number(file.size) : null,
    contentUrl: `/api/media/${id}`,
  };
}

export function sortMediaByName(items: MediaItem[]) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, "es", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
