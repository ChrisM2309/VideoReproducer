const DEFAULT_IMAGE_DURATION_MS = 7000;
const DEFAULT_AUTO_REFRESH_INTERVAL_MS = 300000;

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export const appConfig = {
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
  imageDuration: parseNumber(
    process.env.NEXT_PUBLIC_IMAGE_DURATION_MS,
    DEFAULT_IMAGE_DURATION_MS,
  ),
  autoRefreshInterval: parseNumber(
    process.env.NEXT_PUBLIC_AUTO_REFRESH_INTERVAL_MS,
    DEFAULT_AUTO_REFRESH_INTERVAL_MS,
  ),
  autoplay: parseBoolean(process.env.NEXT_PUBLIC_AUTOPLAY, true),
  loop: parseBoolean(process.env.NEXT_PUBLIC_LOOP, true),
  showFileNames: parseBoolean(process.env.NEXT_PUBLIC_SHOW_FILE_NAMES, true),
  startMuted: parseBoolean(process.env.NEXT_PUBLIC_START_MUTED, true),
};

export const publicAppConfig = {
  imageDuration: appConfig.imageDuration,
  autoRefreshInterval: appConfig.autoRefreshInterval,
  autoplay: appConfig.autoplay,
  loop: appConfig.loop,
  showFileNames: appConfig.showFileNames,
  startMuted: appConfig.startMuted,
  isDriveConfigured: Boolean(appConfig.folderId),
};

export type PublicAppConfig = typeof publicAppConfig;
