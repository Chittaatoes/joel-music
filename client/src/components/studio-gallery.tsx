import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronLeft, ChevronRight, Guitar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GalleryItem } from "@shared/schema";

type DisplayItem = {
  id: string;
  imageUrl: string;
  bandName: string;
  serviceType: string;
  quote: string | null;
  likes: number;
};

const AUTOPLAY_MS = 5000;
const RESUME_AFTER_MS = 3000;
const RENDER_BASE = "https://joel-api.onrender.com";

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({
    x: dir >= 0 ? "100%" : "-100%",
  }),
  center: {
    x: 0,
    transition: { duration: 0.32, ease: "easeOut" as const },
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "-100%" : "100%",
    transition: { duration: 0.32, ease: "easeOut" as const },
  }),
};

interface Props {
  onBook: () => void;
}

function normalizeImageUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${RENDER_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getDeviceId(): string {
  let id = localStorage.getItem("gallery_device_id");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("gallery_device_id", id);
  }
  return id;
}

export default function StudioGallery({ onBook }: Props) {
  const queryClient = useQueryClient();
  const [deviceId] = useState<string>(() => getDeviceId());

  const { data: dbItems = [] } = useQuery<GalleryItem[]>({
    queryKey: ["/api/gallery"],
    queryFn: async () => {
      const res = await fetch("/api/gallery");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: likedIds = [] } = useQuery<string[]>({
    queryKey: ["/api/gallery/liked", deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/gallery/liked?deviceId=${encodeURIComponent(deviceId)}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const items: DisplayItem[] = dbItems.map((i) => ({
    id: i.id,
    imageUrl: normalizeImageUrl(i.imageUrl),
    bandName: i.bandName,
    serviceType: i.serviceType,
    quote: i.quote ?? null,
    likes: i.likes ?? 0,
  }));

  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const [localLikes, setLocalLikes] = useState<Record<string, number>>({});
  const [likeAnimId, setLikeAnimId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; id: string }>({ time: 0, id: "" });

  const [desktopPage, setDesktopPage] = useState(0);
  const totalDesktopPages = Math.max(1, Math.ceil(items.length / 5));

  const likeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/gallery/${itemId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ liked: boolean; total: number }>;
    },
    onSuccess: (data, itemId) => {
      setLocalLikes((prev) => ({ ...prev, [itemId]: data.total }));
      queryClient.setQueryData<string[]>(["/api/gallery/liked", deviceId], (old = []) => {
        if (data.liked) return old.includes(itemId) ? old : [...old, itemId];
        return old.filter((id) => id !== itemId);
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
    },
  });

  const pause = useCallback(() => {
    setIsPaused(true);
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setIsPaused(false), RESUME_AFTER_MS);
  }, []);

  const go = useCallback((idx: number, dir: number) => {
    const safe = ((idx % items.length) + items.length) % items.length;
    setDirection(dir);
    setCurrent(safe);
  }, [items.length]);

  const next = useCallback(() => go(current + 1, 1), [current, go]);
  const prev = useCallback(() => go(current - 1, -1), [current, go]);

  useEffect(() => {
    const safeIdx = Math.min(current, Math.max(0, items.length - 1));
    if (safeIdx !== current) setCurrent(safeIdx);
  }, [items.length]);

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const t = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % items.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [isPaused, items.length]);

  useEffect(() => {
    if (totalDesktopPages <= 1) return;
    const t = setInterval(() => {
      setDesktopPage((p) => (p + 1) % totalDesktopPages);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [totalDesktopPages]);

  const handleLike = useCallback((id: string) => {
    setLikeAnimId(id);
    setTimeout(() => setLikeAnimId(null), 800);
    pause();
    likeMutation.mutate(id);
  }, [pause, likeMutation]);

  const handleTap = useCallback((id: string) => {
    const now = Date.now();
    if (now - lastTapRef.current.time < 300 && lastTapRef.current.id === id) {
      handleLike(id);
    }
    lastTapRef.current = { time: now, id };
  }, [handleLike]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      pause();
      const isSwipe = Math.abs(info.offset.x) > 40 || Math.abs(info.velocity.x) > 200;
      if (isSwipe) {
        if (info.offset.x < 0) next();
        else prev();
      }
    },
    [pause, next, prev]
  );

  if (items.length === 0) return null;

  const item = items[current];
  const isLiked = (id: string) => likedIds.includes(id);
  const getLikes = (id: string) => localLikes[id] ?? items.find((i) => i.id === id)?.likes ?? 0;

  return (
    <section data-testid="section-gallery">
      <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Guitar className="h-5 w-5 text-muted-foreground" />
        Galeri Studio
      </h2>

      <div className="lg:hidden">
        <div
          className="relative overflow-hidden rounded-2xl aspect-[4/3] sm:aspect-[16/9]"
          style={{ touchAction: "pan-y" }}
        >
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.div
              key={item.id}
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragStart={pause}
              onDragEnd={handleDragEnd}
              onTap={() => handleTap(item.id)}
              className="absolute inset-0 select-none cursor-grab active:cursor-grabbing"
            >
              <div className="relative w-full h-full overflow-hidden rounded-2xl">
                <img
                  src={item.imageUrl}
                  alt={item.bandName}
                  className="h-full w-full object-cover pointer-events-none"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <AnimatePresence>
                  {likeAnimId === item.id && (
                    <motion.div
                      key="heart"
                      initial={{ scale: 0.3, opacity: 1, y: 0 }}
                      animate={{ scale: 1.5, opacity: 0, y: -80 }}
                      exit={{}}
                      transition={{ duration: 0.75, ease: "easeOut" }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                      <Heart className="h-24 w-24 fill-red-500 text-red-500 drop-shadow-2xl" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55 mb-0.5">
                        {item.serviceType}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                        {item.bandName}
                      </p>
                      {item.quote && (
                        <p className="mt-1.5 text-xs text-white/70 italic line-clamp-1">
                          "{item.quote}"
                        </p>
                      )}
                    </div>
                    <LikeButton
                      liked={isLiked(item.id)}
                      total={getLikes(item.id)}
                      onClick={(e) => { e.stopPropagation(); handleLike(item.id); }}
                      testId={`button-like-${item.id}`}
                      size="mobile"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBook();
                    }}
                    data-testid="button-gallery-booking"
                  >
                    <Guitar className="mr-1.5 h-3.5 w-3.5" />
                    Booking Sekarang
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          {items.length > 1 && (
            <>
              <button
                onClick={() => { pause(); prev(); }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 active:scale-90"
                data-testid="button-gallery-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => { pause(); next(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 active:scale-90"
                data-testid="button-gallery-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {items.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { pause(); go(i, i > current ? 1 : -1); }}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "h-2 w-6 bg-primary"
                    : "h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                data-testid={`button-gallery-dot-${i}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: 5-slot grid with per-page auto-slide */}
      <div className="hidden lg:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={desktopPage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >
            {(() => {
              const pageItems = items.slice(desktopPage * 5, desktopPage * 5 + 5);
              const topRow = pageItems.slice(0, 3);
              const bottomRow = pageItems.slice(3, 5);
              return (
                <>
                  <div className="grid lg:grid-cols-3 gap-4">
                    {topRow.map((g) => (
                      <DesktopCard
                        key={g.id}
                        item={g}
                        liked={isLiked(g.id)}
                        likes={getLikes(g.id)}
                        likeAnimId={likeAnimId}
                        onLike={() => handleLike(g.id)}
                        onBook={onBook}
                      />
                    ))}
                  </div>
                  {bottomRow.length > 0 && (
                    <div className={`grid gap-4 mt-4 ${bottomRow.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-2"}`}>
                      {bottomRow.map((g) => (
                        <DesktopCard
                          key={g.id}
                          item={g}
                          liked={isLiked(g.id)}
                          likes={getLikes(g.id)}
                          likeAnimId={likeAnimId}
                          onLike={() => handleLike(g.id)}
                          onBook={onBook}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Desktop page dots */}
        {totalDesktopPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: totalDesktopPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setDesktopPage(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === desktopPage
                    ? "h-2 w-6 bg-primary"
                    : "h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                data-testid={`button-gallery-desktop-dot-${i}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LikeButton({
  liked,
  total,
  onClick,
  testId,
  size,
}: {
  liked: boolean;
  total: number;
  onClick: (e: React.MouseEvent) => void;
  testId?: string;
  size: "mobile" | "desktop";
}) {
  if (size === "mobile") {
    return (
      <button
        onClick={onClick}
        className="shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/50 active:scale-90 min-w-[40px] px-1.5 py-1.5"
        data-testid={testId}
      >
        <Heart
          className={`h-5 w-5 transition-all ${
            liked ? "fill-red-500 text-red-500 scale-110" : "text-white"
          }`}
        />
        {total > 0 && (
          <span className="text-[9px] font-bold text-white leading-none">{total}</span>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 h-8 min-w-8 px-1.5 shrink-0 rounded-lg bg-white/15 backdrop-blur-sm hover:bg-white/25 transition active:scale-90"
    >
      <Heart
        className={`h-4 w-4 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-white"}`}
      />
      {total > 0 && (
        <span className="text-[8px] font-bold text-white leading-none">{total}</span>
      )}
    </button>
  );
}

function DesktopCard({
  item,
  liked,
  likes,
  likeAnimId,
  onLike,
  onBook,
}: {
  item: DisplayItem;
  liked: boolean;
  likes: number;
  likeAnimId: string | null;
  onLike: () => void;
  onBook: () => void;
}) {
  const lastTapRef = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) onLike();
    lastTapRef.current = now;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={handleClick}
      className="group relative overflow-hidden rounded-2xl cursor-pointer"
      data-testid={`card-gallery-desktop-${item.id}`}
    >
      <div className="relative aspect-[4/3]">
        <img
          src={item.imageUrl}
          alt={item.bandName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <AnimatePresence>
          {likeAnimId === item.id && (
            <motion.div
              key="heart-desktop"
              initial={{ scale: 0.3, opacity: 1, y: 0 }}
              animate={{ scale: 1.4, opacity: 0, y: -60 }}
              exit={{}}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55 mb-0.5">
            {item.serviceType}
          </p>
          <p className="text-lg font-bold text-white leading-tight">{item.bandName}</p>
          {item.quote && (
            <p className="mt-1 text-xs text-white/75 italic line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              "{item.quote}"
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
            <Button
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onBook();
              }}
            >
              <Guitar className="mr-1.5 h-3 w-3" />
              Booking Sekarang
            </Button>
            <LikeButton
              liked={liked}
              total={likes}
              onClick={(e) => { e.stopPropagation(); onLike(); }}
              size="desktop"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
