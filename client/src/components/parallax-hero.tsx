import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

const RANGE  = 14;
const SPRING = { damping: 45, stiffness: 80, mass: 1.2 };

interface ParallaxHeroProps {
  lowestPrice: string;
  onInfoClick: () => void;
}

export default function ParallaxHero({ lowestPrice, onInfoClick }: ParallaxHeroProps) {
  const [, navigate] = useLocation();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springX = useSpring(rawX, SPRING);
  const springY = useSpring(rawY, SPRING);

  const imgX = useTransform(springX, [-1, 1], [-RANGE, RANGE]);
  const imgY = useTransform(springY, [-1, 1], [-RANGE, RANGE]);

  const rafId        = useRef<number>(0);
  const gyroGranted  = useRef(false);
  const gyroRequested = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ua        = navigator.userAgent;
    const isMobile  = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isIOS     = /iPhone|iPad|iPod/i.test(ua);

    // DeviceOrientationEvent handler — RAF-throttled to ~30 fps for perf
    const handleOrientation = (e: DeviceOrientationEvent) => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const gamma = Math.max(-22, Math.min(22, e.gamma ?? 0));
        const beta  = Math.max(-22, Math.min(22, (e.beta ?? 0) - 45));
        rawX.set(gamma / 22);
        rawY.set(beta  / 22);
      });
    };

    // Mouse handler — RAF-throttled
    const handleMouse = (e: MouseEvent) => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const cx = window.innerWidth  / 2;
        const cy = window.innerHeight / 2;
        rawX.set(Math.max(-1, Math.min(1, (e.clientX - cx) / cx)));
        rawY.set(Math.max(-1, Math.min(1, (e.clientY - cy) / cy)));
      });
    };

    const attachGyro = () => {
      if (gyroGranted.current) return;
      gyroGranted.current = true;
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    };

    // iOS 13+: requestPermission() MUST be called synchronously inside a user gesture.
    // Calling it at mount (outside a gesture) is silently rejected by Safari.
    // Solution: attach a one-time touchstart listener that calls it.
    const requestIOSGyro = () => {
      if (gyroRequested.current) return;
      gyroRequested.current = true;

      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        DOE.requestPermission()
          .then((state: string) => {
            if (state === "granted") attachGyro();
          })
          .catch(() => {});
      } else {
        // Older iOS / already granted
        attachGyro();
      }
    };

    if (isMobile && typeof DeviceOrientationEvent !== "undefined") {
      if (isIOS) {
        // iOS: ONLY trigger from user gesture — never call directly at mount
        document.addEventListener("touchstart", requestIOSGyro, { once: true, passive: true });
      } else {
        // Android & other mobile: no permission required, attach directly
        attachGyro();
      }

      return () => {
        cancelAnimationFrame(rafId.current);
        window.removeEventListener("deviceorientation", handleOrientation);
        document.removeEventListener("touchstart", requestIOSGyro);
      };
    } else {
      // Desktop: mouse parallax
      window.addEventListener("mousemove", handleMouse, { passive: true });
      return () => {
        cancelAnimationFrame(rafId.current);
        window.removeEventListener("mousemove", handleMouse);
      };
    }
  }, [rawX, rawY]);

  return (
    <section
      className="relative overflow-hidden bg-[#0a0a0c]"
      style={{ contain: "layout paint" }}
    >
      {/* ── Hero image — GPU-composited, moves with mouse/gyro ── */}
      <motion.div
        className="absolute inset-0"
        style={{ x: imgX, y: imgY, scale: 1.06, willChange: "transform" }}
      >
        <img
          src="/images/hero-studio.png"
          alt="Joel Music Studio"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      </motion.div>

      {/* ── Cinematic overlays (merged into 3 layers) ── */}
      <div className="absolute inset-0 pointer-events-none bg-black/30" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 38%, rgba(0,0,0,0.18) 68%, transparent 100%)," +
            "linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, transparent 35%)," +
            "radial-gradient(ellipse 70% 55% at 65% 50%, rgba(20,180,180,0.09) 0%, transparent 70%)",
        }}
      />

      {/* ── Mobile hero content ── */}
      <div className="relative flex flex-col justify-end min-h-[60vh] md:hidden px-5 pb-8 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge
            variant="secondary"
            className="mb-3 self-start bg-white/15 text-white border-white/20 text-xs backdrop-blur-sm"
            data-testid="badge-price"
          >
            Mulai dari Rp {lowestPrice}
          </Badge>
          <h1
            className="mb-2.5 text-[1.75rem] font-bold tracking-tight text-white leading-[1.18]"
            data-testid="text-hero-title"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.55)" }}
          >
            Joel Music Studio<br />& Recording
          </h1>
          <p className="mb-6 text-[13px] text-white/70 leading-relaxed max-w-[17rem]">
            Studio musik profesional di Tangerang. Rehearsal, Recording, Karaoke, dan Sewa Alat Musik.
          </p>
          <Button
            size="lg"
            className="w-full h-12 text-[15px] font-semibold rounded-2xl shadow-xl"
            onClick={() => navigate("/booking")}
            data-testid="button-hero-booking"
          >
            Booking Sekarang
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* ── Desktop hero content ── */}
      <div className="relative hidden md:flex flex-col justify-end min-h-[92vh] mx-auto max-w-5xl px-8 pb-24">
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge
            variant="secondary"
            className="mb-5 bg-white/15 text-white border-white/20 backdrop-blur-sm"
            data-testid="badge-price-desktop"
          >
            Mulai dari Rp {lowestPrice}
          </Badge>
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-white lg:text-5xl xl:text-[3.5rem] leading-[1.12]"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}
          >
            Joel Music Studio<br />& Recording
          </h1>
          <p className="mb-7 text-base text-white/75 sm:text-lg leading-relaxed max-w-md">
            Studio musik profesional di Tangerang. Rehearsal, Recording, Karaoke, dan Sewa Alat Musik.
            Booking online, bayar mudah via QRIS.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="shadow-xl"
              onClick={() => navigate("/booking")}
              data-testid="button-hero-booking-desktop"
            >
              Booking Sekarang
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/25 backdrop-blur-sm hover:bg-white/18"
              onClick={onInfoClick}
              data-testid="button-hero-info"
            >
              Lihat Info Studio
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
