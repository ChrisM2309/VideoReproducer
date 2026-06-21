/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Expand,
  GalleryVerticalEnd,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeOff,
  X,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PublicAppConfig } from "@/lib/app-config";
import type { MediaItem } from "@/lib/media";

interface MediaApiResponse {
  items: MediaItem[];
  fetchedAt: string;
  config?: PublicAppConfig;
}

type ViewerStatus = "loading" | "ready" | "empty" | "error";

interface MediaViewerProps {
  config: PublicAppConfig;
}

function formatKind(kind: MediaItem["kind"]) {
  return kind === "video" ? "Video" : "Imagen";
}

function formatClock(timestamp: string | null) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function ControlButton({
  label,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

function StatusView({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-xl rounded-lg border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <p className="text-sm uppercase tracking-[0.18em] text-white/45">
          Visor Multimedia
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

function ExplorerOverlay({
  items,
  activeId,
  onClose,
  onSelect,
}: {
  items: MediaItem[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-black/88 px-4 py-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Explorar
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Archivos disponibles
            </h2>
          </div>
          <ControlButton label="Cerrar explorador" onClick={onClose}>
            <X className="h-5 w-5" />
          </ControlButton>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => {
            const isActive = item.id === activeId;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(index)}
                className={`group overflow-hidden rounded-lg border text-left transition ${
                  isActive
                    ? "border-sky-400 bg-sky-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/8"
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-black">
                  {item.kind === "image" ? (
                    <img
                      src={item.contentUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <>
                      <video
                        src={item.contentUrl}
                        muted
                        preload="metadata"
                        playsInline
                        className="h-full w-full object-cover opacity-70"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <div className="rounded-full bg-black/55 p-3 text-white">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/80">
                    {index + 1}
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-medium text-white">
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>{formatKind(item.kind)}</span>
                    {isActive ? <span>Activo</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MediaViewer({ config }: MediaViewerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(!config.autoplay);
  const [isMuted, setIsMuted] = useState(config.startMuted);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackSeed, setPlaybackSeed] = useState(0);
  const [loadedMediaKey, setLoadedMediaKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeIndexRef = useRef(0);
  const itemsRef = useRef<MediaItem[]>([]);
  const failedIdsRef = useRef<string[]>([]);
  const lastTapAtRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    failedIdsRef.current = failedIds;
  }, [failedIds]);

  const currentItem = items[activeIndex] ?? null;
  const activeId = currentItem?.id ?? null;
  const currentMediaKey = currentItem ? `${currentItem.id}:${playbackSeed}` : null;
  const currentLoading = currentMediaKey !== null && loadedMediaKey !== currentMediaKey;
  const hasMedia = status === "ready" && items.length > 0;
  const blockedForPlayback = isPaused || isExplorerOpen;
  const unavailableSet = useMemo(() => new Set(failedIds), [failedIds]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const setIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, itemsRef.current.length - 1));
      setActiveIndex(clamped);
      setPlaybackSeed((seed) => seed + 1);
      revealControls();
    },
    [revealControls],
  );

  const findNextIndex = useCallback(
    (startIndex: number, direction: 1 | -1, extraFailedIds: string[] = []) => {
      if (!itemsRef.current.length) {
        return -1;
      }

      const skip = new Set([...failedIdsRef.current, ...extraFailedIds]);
      const total = itemsRef.current.length;
      const maxOffset = config.loop ? total : total - 1;

      for (let offset = 1; offset <= maxOffset; offset += 1) {
        const rawIndex = startIndex + direction * offset;
        if (!config.loop && (rawIndex < 0 || rawIndex >= total)) {
          break;
        }

        const candidate = ((rawIndex % total) + total) % total;
        const item = itemsRef.current[candidate];

        if (item && !skip.has(item.id)) {
          return candidate;
        }
      }

      return -1;
    },
    [config.loop],
  );

  const markCurrentAsUnavailable = useCallback(
    (message: string) => {
      const item = itemsRef.current[activeIndexRef.current];
      if (!item) {
        return;
      }

      if (failedIdsRef.current.includes(item.id)) {
        return;
      }

      const nextFailedIds = [...failedIdsRef.current, item.id];
      setFailedIds(nextFailedIds);
      setLastError(message);

      const nextIndex = findNextIndex(activeIndexRef.current, 1, [item.id]);
      if (nextIndex === -1) {
        setStatus("error");
        return;
      }

      setIndex(nextIndex);
    },
    [findNextIndex, setIndex],
  );

  const fetchItems = useCallback(
    async (preserveCurrent: boolean) => {
      setIsRefreshing(true);

      try {
        const response = await fetch(`/api/media?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | MediaApiResponse
          | { error?: string };
        const errorMessage = "error" in payload ? payload.error : undefined;

        if (!response.ok) {
          throw new Error(errorMessage ?? "No fue posible leer Google Drive.");
        }

        const nextItems = "items" in payload ? payload.items ?? [] : [];
        const fetchedAt =
          "fetchedAt" in payload ? payload.fetchedAt ?? new Date().toISOString() : new Date().toISOString();
        setFailedIds([]);
        setLastUpdatedAt(fetchedAt);
        setLastError(null);

        if (!nextItems.length) {
          setItems([]);
          setActiveIndex(0);
          setStatus("empty");
          return;
        }

        const currentId = preserveCurrent
          ? itemsRef.current[activeIndexRef.current]?.id
          : null;

        const nextIndex = currentId
          ? nextItems.findIndex((item) => item.id === currentId)
          : 0;

        setItems(nextItems);
        setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
        setStatus("ready");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible actualizar el contenido.";

        setLastError(message);
        setStatus(itemsRef.current.length ? "ready" : "error");
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
  );

  const goToNext = useCallback(() => {
    const nextIndex = findNextIndex(activeIndexRef.current, 1);
    if (nextIndex !== -1) {
      setIndex(nextIndex);
    }
  }, [findNextIndex, setIndex]);

  const goToPrevious = useCallback(() => {
    const previousIndex = findNextIndex(activeIndexRef.current, -1);
    if (previousIndex !== -1) {
      setIndex(previousIndex);
    }
  }, [findNextIndex, setIndex]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await rootRef.current?.requestFullscreen();
      revealControls();
      return;
    }

    await document.exitFullscreen();
  }, [revealControls]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchItems(false);
    });
  }, [fetchItems]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchItems(true);
    }, config.autoRefreshInterval);

    return () => window.clearInterval(intervalId);
  }, [config.autoRefreshInterval, fetchItems]);

  useEffect(() => {
    if (!controlsVisible || isExplorerOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [controlsVisible, activeId, isExplorerOpen]);

  useEffect(() => {
    if (!currentItem || !currentLoading || status !== "ready") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      markCurrentAsUnavailable(
        "Un archivo no respondio a tiempo y fue omitido automaticamente.",
      );
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [currentItem, currentLoading, markCurrentAsUnavailable, status]);

  useEffect(() => {
    if (
      !currentItem ||
      currentItem.kind !== "image" ||
      blockedForPlayback ||
      currentLoading ||
      status !== "ready"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      goToNext();
    }, config.imageDuration);

    return () => window.clearTimeout(timeoutId);
  }, [
    blockedForPlayback,
    config.imageDuration,
    currentItem,
    currentLoading,
    goToNext,
    status,
  ]);

  useEffect(() => {
    if (!currentItem || currentItem.kind !== "video" || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    video.muted = isMuted;

    if (blockedForPlayback) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        setLastError(
          "El navegador bloqueo la reproduccion automatica con audio. Puedes volver a activarlo manualmente.",
        );
      });
    }
  }, [activeId, blockedForPlayback, currentItem, isMuted, playbackSeed]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      revealControls();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isExplorerOpen) {
        event.preventDefault();
        setIsExplorerOpen(false);
        return;
      }

      if (!itemsRef.current.length) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
        case " ":
          event.preventDefault();
          setIsPaused((value) => !value);
          revealControls();
          break;
        case "f":
        case "F":
          event.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          event.preventDefault();
          setIsMuted((value) => !value);
          revealControls();
          break;
        default:
          break;
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goToNext, goToPrevious, isExplorerOpen, revealControls, toggleFullscreen]);

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      revealControls();
    },
    [revealControls],
  );

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;

      if (startX === null || startY === null) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      touchStartXRef.current = null;
      touchStartYRef.current = null;

      if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          goToNext();
        } else {
          goToPrevious();
        }
        return;
      }

      const now = Date.now();
      if (now - lastTapAtRef.current < 300) {
        void toggleFullscreen();
      } else {
        setControlsVisible((visible) => !visible);
      }
      lastTapAtRef.current = now;
    },
    [goToNext, goToPrevious, toggleFullscreen],
  );

  const handleVideoEnded = useCallback(() => {
    goToNext();
  }, [goToNext]);

  const handleSelectFromExplorer = useCallback(
    (index: number) => {
      setIsExplorerOpen(false);
      setIndex(index);
    },
    [setIndex],
  );

  const handleKeyDownOnRoot = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" && isExplorerOpen) {
        setIsExplorerOpen(false);
      }
    },
    [isExplorerOpen],
  );

  if (!config.isDriveConfigured) {
    return (
      <StatusView
        title="Falta configurar Google Drive"
        description="Define GOOGLE_DRIVE_FOLDER_ID y las credenciales de la cuenta de servicio para comenzar a mostrar contenido."
      />
    );
  }

  if (status === "loading") {
    return (
      <StatusView
        title="Cargando contenido"
        description="Estamos consultando la carpeta configurada de Google Drive."
      />
    );
  }

  if (status === "empty") {
    return (
      <StatusView
        title="Carpeta sin contenido"
        description="No hay imagenes o videos compatibles disponibles en esta carpeta."
        action={
          <button
            type="button"
            onClick={() => void fetchItems(false)}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  if (status === "error" && !items.length) {
    return (
      <StatusView
        title="No fue posible cargar el visor"
        description={
          lastError ??
          "Ocurrio un problema de conexion con Google Drive y no hay una lista previa disponible."
        }
        action={
          <button
            type="button"
            onClick={() => void fetchItems(false)}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Volver a intentar
          </button>
        }
      />
    );
  }

  if (status === "error" && failedIds.length >= items.length) {
    return (
      <StatusView
        title="No hay archivos disponibles para reproducir"
        description={
          lastError ??
          "Todos los archivos compatibles fallaron al cargar. Revisa los archivos de la carpeta y vuelve a intentarlo."
        }
        action={
          <button
            type="button"
            onClick={() => void fetchItems(false)}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Actualizar contenido
          </button>
        }
      />
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onMouseMove={revealControls}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDownOnRoot}
      className="relative flex min-h-screen flex-1 overflow-hidden bg-[#020202] text-white outline-none"
    >
      {currentItem?.kind === "image" ? (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-28 blur-3xl"
          style={{ backgroundImage: `url(${currentItem.contentUrl})` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_45%)]" />
      <div className="absolute inset-0 bg-black/45" />

      {isExplorerOpen ? (
        <ExplorerOverlay
          items={items}
          activeId={activeId}
          onClose={() => setIsExplorerOpen(false)}
          onSelect={handleSelectFromExplorer}
        />
      ) : null}

      {lastError && hasMedia ? (
        <div className="absolute left-4 right-4 top-4 z-40 mx-auto max-w-2xl rounded-lg border border-amber-400/25 bg-amber-500/12 px-4 py-3 text-sm text-amber-100 backdrop-blur">
          {lastError}
        </div>
      ) : null}

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-8">
        {!currentItem || unavailableSet.has(currentItem.id) ? null : (
          <div className="relative flex h-full w-full items-center justify-center">
            {currentItem.kind === "image" ? (
              <img
                key={`${currentItem.id}-${playbackSeed}`}
                src={currentItem.contentUrl}
                alt={currentItem.name}
                onLoad={() => setLoadedMediaKey(currentMediaKey)}
                onError={() =>
                  markCurrentAsUnavailable(
                    "Una imagen no pudo cargarse y fue omitida automaticamente.",
                  )
                }
                className="max-h-[calc(100vh-3rem)] w-auto max-w-full rounded-sm object-contain shadow-[0_24px_80px_rgba(0,0,0,0.48)] animate-[fadeIn_420ms_ease]"
              />
            ) : (
              <video
                key={`${currentItem.id}-${playbackSeed}`}
                ref={videoRef}
                src={currentItem.contentUrl}
                muted={isMuted}
                playsInline
                preload="metadata"
                onLoadedData={() => setLoadedMediaKey(currentMediaKey)}
                onEnded={handleVideoEnded}
                onError={() =>
                  markCurrentAsUnavailable(
                    "Un video no pudo reproducirse y fue omitido automaticamente.",
                  )
                }
                className="max-h-[calc(100vh-3rem)] w-auto max-w-full rounded-sm object-contain shadow-[0_24px_80px_rgba(0,0,0,0.48)] animate-[fadeIn_420ms_ease]"
              />
            )}
          </div>
        )}
      </main>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/15 to-transparent px-4 py-4 transition-opacity duration-300 sm:px-6 ${
          controlsVisible || isExplorerOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto max-w-2xl rounded-lg bg-black/35 px-4 py-3 backdrop-blur">
            {config.showFileNames && currentItem ? (
              <p className="line-clamp-1 text-sm font-medium text-white">
                {currentItem.name}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
              <span>
                {Math.min(activeIndex + 1, items.length)} / {items.length}
              </span>
              {currentItem ? <span>{formatKind(currentItem.kind)}</span> : null}
              {lastUpdatedAt ? <span>Actualizado {formatClock(lastUpdatedAt)}</span> : null}
              {currentLoading ? <span>Cargando...</span> : null}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <ControlButton
              label="Actualizar contenido"
              onClick={() => void fetchItems(true)}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </ControlButton>
            <ControlButton label="Pantalla completa" onClick={() => void toggleFullscreen()}>
              <Expand className="h-5 w-5" />
            </ControlButton>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-28 items-center justify-center sm:flex">
        <div
          className={`pointer-events-auto transition-opacity duration-300 ${
            controlsVisible && !isExplorerOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <ControlButton label="Anterior" onClick={goToPrevious}>
            <SkipBack className="h-6 w-6" />
          </ControlButton>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-28 items-center justify-center sm:flex">
        <div
          className={`pointer-events-auto transition-opacity duration-300 ${
            controlsVisible && !isExplorerOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <ControlButton label="Siguiente" onClick={goToNext}>
            <SkipForward className="h-6 w-6" />
          </ControlButton>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4 pt-10 transition-opacity duration-300 sm:px-6 ${
          controlsVisible || isExplorerOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto mx-auto flex max-w-max items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-3 backdrop-blur">
          <ControlButton label="Anterior" onClick={goToPrevious} className="sm:hidden">
            <SkipBack className="h-5 w-5" />
          </ControlButton>
          <ControlButton
            label={isPaused ? "Reanudar presentacion" : "Pausar presentacion"}
            onClick={() => {
              setIsPaused((value) => !value);
              revealControls();
            }}
          >
            {isPaused ? (
              <Play className="h-5 w-5 fill-current" />
            ) : (
              <Pause className="h-5 w-5 fill-current" />
            )}
          </ControlButton>
          <ControlButton
            label={isMuted ? "Activar sonido" : "Silenciar"}
            onClick={() => {
              setIsMuted((value) => !value);
              revealControls();
            }}
          >
            {isMuted ? <VolumeOff className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </ControlButton>
          <ControlButton
            label="Explorar galeria"
            onClick={() => {
              setIsExplorerOpen(true);
              revealControls();
            }}
          >
            <GalleryVerticalEnd className="h-5 w-5" />
          </ControlButton>
          <ControlButton label="Pantalla completa" onClick={() => void toggleFullscreen()}>
            <Expand className="h-5 w-5" />
          </ControlButton>
          <ControlButton label="Actualizar contenido" onClick={() => void fetchItems(true)}>
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </ControlButton>
          <ControlButton label="Siguiente" onClick={goToNext} className="sm:hidden">
            <SkipForward className="h-5 w-5" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
