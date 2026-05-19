import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StudioGallery from "@/components/studio-gallery";
import ParallaxHero from "@/components/parallax-hero";
import {
  Music,
  Clock,
  MapPin,
  Phone,
  Drum,
  Guitar,
  CalendarDays,
  Mic,
  Speaker,
  Wind,
  Headphones,
  FileText,
  ChevronRight,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Users,
  Disc3,
  MicVocal,
  Package,
  ShieldCheck,
  Keyboard,
  Home,
  CupSoda,
} from "lucide-react";
import { SiInstagram } from "react-icons/si";
import type { Service, PricingTier } from "@shared/schema";
import { usePageMeta } from "@/lib/seo";
const logoImage = "/images/logo.png";
const heroImage = "/images/hero-studio.png";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function formatScheduleHours(openHour: number, closeHour: number): string {
  const open = `${String(openHour).padStart(2, "0")}:00`;
  const close = closeHour >= 24 ? "00:00" : `${String(closeHour).padStart(2, "0")}:00`;
  return `${open} - ${close}`;
}

const staticLayanan = [
  { name: "Rehearsal / Latihan", desc: "Latihan band dengan alat lengkap", icon: Music },
  { name: "Live Record", desc: "Rekaman live langsung di studio", icon: Disc3 },
  { name: "Karaoke", desc: "Karaoke dengan sound system pro", icon: MicVocal },
  { name: "Cover Lagu / Minus One", desc: "Cover lagu dengan tuning vocal & mixing", icon: Headphones },
  { name: "Sewa Keyboard", desc: "Tambahan keyboard saat rehearsal", icon: Keyboard },
  { name: "Sewa Alat Musik", desc: "Rental drum, gitar, bass, dll", icon: Package },
];

const facilities = [
  { name: "Drum Electric", icon: Drum },
  { name: "Gitar & Bass", icon: Guitar },
  { name: "Microphone", icon: Mic },
  { name: "Sound System", icon: Speaker },
  { name: "AC", icon: Wind },
  { name: "Monitor Mix", icon: Headphones },
];

const ketentuanList = [
  "Booking minimal 1 jam, maksimal 4 jam per sesi",
  "Pembayaran dilakukan di awal via QRIS sebelum jam booking dimulai",
  "Harap datang 10 menit sebelum jam booking untuk persiapan",
  "Dilarang membawa makanan dan minuman ke dalam studio",
  "Kerusakan alat yang disebabkan oleh penyewa menjadi tanggung jawab penyewa",
  "Pembatalan booking harus dilakukan minimal 2 jam sebelum jadwal",
  "Kapasitas maksimal studio adalah 7 orang",
];

function getToday() {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[new Date().getDay()];
}

type PriceRow = {
  name: string;
  price: string;
  note: string | null;
  promo: boolean;
  originalPrice: string | null;
};

function buildPriceRows(services: Service[]): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const svc of services) {
    if (svc.isFixedPrice && svc.fixedPrice != null) {
      rows.push({
        name: svc.name,
        price: `${Math.round(svc.fixedPrice / 1000)}K`,
        note: svc.note || null,
        promo: false,
        originalPrice: null,
      });
    } else if (svc.pricePerHour != null) {
      const tiers = (svc.pricingTiers as PricingTier[] | null) || [];
      if (tiers.length === 0) {
        rows.push({
          name: svc.name,
          price: `${Math.round(svc.pricePerHour / 1000)}K`,
          note: svc.note || null,
          promo: false,
          originalPrice: null,
        });
      } else {
        rows.push({
          name: `${svc.name} 1 Jam`,
          price: `${Math.round(svc.pricePerHour / 1000)}K`,
          note: null,
          promo: false,
          originalPrice: null,
        });
        const sorted = [...tiers].sort((a, b) => a.hours - b.hours);
        for (const tier of sorted) {
          const regular = svc.pricePerHour * tier.hours;
          const isPromo = tier.price < regular;
          const savings = regular - tier.price;
          rows.push({
            name: `${svc.name} ${tier.hours} Jam`,
            price: `${Math.round(tier.price / 1000)}K`,
            note: isPromo ? `Hemat Rp ${savings.toLocaleString("id-ID")}!` : (svc.note || null),
            promo: isPromo,
            originalPrice: isPromo ? `${Math.round(regular / 1000)}K` : null,
          });
        }
      }
    }
  }
  return rows;
}

function getLowestPrice(services: Service[]): string {
  let min = Infinity;
  for (const svc of services) {
    if (svc.isFixedPrice && svc.fixedPrice != null) {
      min = Math.min(min, svc.fixedPrice);
    } else if (svc.pricePerHour != null) {
      min = Math.min(min, svc.pricePerHour);
    }
  }
  if (!isFinite(min)) return "55.000";
  return min.toLocaleString("id-ID");
}

const PILL_BG     = "rgba(255,255,255,0.88)";
const PILL_SHADOW = "0 -1px 0 rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.12), 0 3px 8px rgba(0,0,0,0.07), inset 0 0 0 0.5px rgba(0,0,0,0.06)";
const ACTIVE_BG   = "rgba(20,160,153,0.13)";
const ICON_ACTIVE = "hsl(187,80%,36%)";
const ICON_MUTED  = "rgba(90,105,110,0.50)";

const USER_TABS = [
  { key: "home",    label: "Beranda", icon: Home,         path: "/" },
  { key: "booking", label: "Booking", icon: Music,        path: "/booking" },
  { key: "food",    label: "Order",   icon: CupSoda,      path: "/food" },
] as const;

function MobileTabBar({ active }: { active: "home" | "booking" | "food" | "history" }) {
  const [, navigate] = useLocation();
  const [bouncing, setBouncing] = useState<string | null>(null);

  const fire = useCallback((key: string, path: string) => {
    setBouncing(key);
    setTimeout(() => setBouncing(null), 480);
    navigate(path);
  }, [navigate]);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden flex items-end px-3 mb-3 gap-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="mobile-tab-bar"
    >
      {/* Main tab pill */}
      <div
        className="flex-1 flex items-center rounded-[50px] px-1 py-1.5"
        style={{ background: PILL_BG, boxShadow: PILL_SHADOW }}
      >
        {USER_TABS.map((tab) => {
          const isActive = active === tab.key;
          const isBouncing = bouncing === tab.key;
          return (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => fire(tab.key, tab.path)}
              className="flex-1 flex flex-col items-center justify-center relative select-none"
              style={{ WebkitTapHighlightColor: "transparent", minHeight: 50, touchAction: "manipulation" }}
            >
              {/* Active inner pill */}
              <div
                className="absolute inset-x-0.5 rounded-[44px] transition-all duration-200"
                style={{
                  top: -2,
                  bottom: -2,
                  background: isActive ? ACTIVE_BG : "transparent",
                  opacity: isActive ? 1 : 0,
                }}
              />

              {/* Icon */}
              <div
                className={`relative z-10 ${isBouncing ? "tab-icon-bounce" : ""}`}
                style={{ willChange: "transform" }}
              >
                <tab.icon
                  style={{
                    width: 22,
                    height: 22,
                    color: isActive ? ICON_ACTIVE : ICON_MUTED,
                    strokeWidth: isActive ? 2.3 : 1.7,
                    transition: "color 0.18s ease, stroke-width 0.18s ease",
                  }}
                />
              </div>

              {/* Label */}
              <span
                className={`relative z-10 leading-none mt-1 ${isBouncing ? "tab-label-in" : ""}`}
                style={{
                  fontSize: 9.5,
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: 0.15,
                  color: isActive ? ICON_ACTIVE : ICON_MUTED,
                  transition: "color 0.18s ease",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* History separate pill */}
      <button
        data-testid="tab-history"
        onClick={() => navigate("/history")}
        className="flex flex-col items-center justify-center rounded-[50px] select-none shrink-0"
        style={{
          background: PILL_BG,
          boxShadow: PILL_SHADOW,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          minHeight: 58,
          width: 58,
        }}
      >
        <CalendarDays
          style={{
            width: 22,
            height: 22,
            color: ICON_MUTED,
            strokeWidth: 1.7,
          }}
        />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 400,
            letterSpacing: 0.15,
            color: ICON_MUTED,
            marginTop: 3,
            lineHeight: 1,
          }}
        >
          Riwayat
        </span>
      </button>
    </nav>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const todayName = getToday();
  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: scheduleRaw = [] } = useQuery<{ dayOfWeek: number; isOpen: boolean; openHour: number; closeHour: number }[]>({
    queryKey: ["/api/operational-schedule"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const todayDow = new Date().getDay();
  const todaySchedule = scheduleRaw.find((s) => s.dayOfWeek === todayDow);
  const studioOpen = (() => {
    if (!todaySchedule) return false;
    if (!todaySchedule.isOpen) return false;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= todaySchedule.openHour * 60 && mins < todaySchedule.closeHour * 60;
  })();

  const priceRows = buildPriceRows(services);
  const lowestPrice = getLowestPrice(services);

  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLogoTap = useCallback(() => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      navigate("/admin");
      return;
    }
    logoTapTimer.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, 2000);
  }, [navigate]);

  usePageMeta({
    title: "Joel Music Studio - Studio Musik Murah & Terdekat | Booking Online",
    description:
      "Studio musik murah dan terdekat untuk rehearsal band, karaoke, live record, dan cover lagu. Sound system pro, alat lengkap, jadwal real-time, pembayaran QRIS, konfirmasi via WhatsApp.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background">
      <section className="sr-only">
        <h2>Joel Music Studio - Studio Musik Murah & Terdekat untuk Booking Online</h2>
        <p>
          Joel Music Studio adalah studio musik murah dan terdekat yang melayani booking
          online untuk rehearsal band, karaoke, live recording, cover lagu, dan minus one.
          Studio dilengkapi sound system profesional, drum electric, gitar, bass, keyboard,
          microphone, monitor mix, dan AC. Cocok untuk band pemula hingga profesional yang
          mencari studio latihan terdekat dengan harga terjangkau.
        </p>
        <h2>Layanan Studio Musik</h2>
        <ul>
          <li>Studio Rehearsal / Latihan Band - sewa studio musik per jam dengan alat lengkap</li>
          <li>Karaoke Studio - karaoke dengan sound system profesional</li>
          <li>Live Recording - rekaman live langsung di studio dengan output WAV</li>
          <li>Cover Lagu / Minus One - jasa cover lagu dengan tuning vocal dan mixing</li>
          <li>Sewa Alat Musik - rental drum, gitar, bass, dan keyboard tambahan</li>
        </ul>
        <h2>Kenapa Pilih Joel Music Studio</h2>
        <p>
          Booking studio musik online lebih mudah dengan jadwal real-time, pembayaran
          QRIS instan, dan konfirmasi otomatis via WhatsApp. Harga sewa studio musik
          mulai dari Rp 55.000 per jam — salah satu studio musik termurah dengan
          fasilitas profesional di sekitar kamu.
        </p>
      </section>

      {/* ── HEADER ── */}
      <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 h-14">
          <div className="flex items-center gap-2.5">
            <img
              src={logoImage}
              alt="Joel Music Studio"
              className="h-8 w-8 rounded-xl object-contain select-none"
              onClick={handleLogoTap}
              style={{ WebkitTapHighlightColor: "transparent", cursor: "default" }}
              data-testid="img-logo"
            />
            <span className="font-semibold text-sm" data-testid="text-brand">Joel Music Studio</span>
          </div>
          {/* Mobile: status chip only */}
          <div className="flex items-center gap-2 md:hidden">
            {studioOpen ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full" data-testid="badge-status-open-header">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Buka
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full" data-testid="badge-status-closed-header">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-white inline-block" />
                Tutup
              </Badge>
            )}
          </div>
          {/* Desktop: original nav buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/history")}
              data-testid="button-nav-history"
            >
              <CalendarDays className="mr-1 h-3 w-3" />
              History
            </Button>
            <Button size="sm" onClick={() => navigate("/booking")} data-testid="button-nav-booking">
              Booking
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO (Parallax) ── */}
      <ParallaxHero
        lowestPrice={lowestPrice}
        onInfoClick={() => document.getElementById("info-section")?.scrollIntoView({ behavior: "smooth" })}
      />


      {/* ── MAIN CONTENT ── */}
      <div id="info-section" className="mx-auto max-w-5xl px-4 py-5 md:py-8 space-y-6 md:pb-8">

        {/* Layanan */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-services">
            <Music className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Layanan Kami
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staticLayanan.map((item) => (
              <Card key={item.name} className="flex items-center gap-3 p-4" data-testid={`card-service-${item.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-center rounded-md bg-primary/10 p-2.5">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <StudioGallery onBook={() => navigate("/booking")} />

        {/* Daftar Harga */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-pricing">
            <Music className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Daftar Harga
          </h2>
          {loadingServices ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-border/60 bg-card">
              {priceRows.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className={`relative flex items-start justify-between gap-3 px-4 py-3.5 transition-colors ${
                    i < priceRows.length - 1 ? "border-b border-border/40" : ""
                  } ${item.promo ? "bg-primary/[0.04]" : ""}`}
                  data-testid={`row-price-${i}`}
                >
                  {/* Promo accent — subtle left edge line */}
                  {item.promo && (
                    <span className="absolute left-0 inset-y-0 w-[3px] rounded-r-full bg-primary/40" />
                  )}
                  <div className="min-w-0 pl-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium tracking-tight">{item.name}</p>
                      {item.promo && (
                        <span
                          className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider border"
                          style={{
                            background: "rgba(20,160,153,0.10)",
                            color: "hsl(187,70%,36%)",
                            borderColor: "rgba(20,160,153,0.25)",
                            letterSpacing: "0.06em",
                          }}
                          data-testid="badge-promo"
                        >
                          Promo
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className={`text-xs mt-0.5 ${item.promo ? "text-primary/60 font-medium" : "text-muted-foreground"}`}>{item.note}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {item.originalPrice && (
                      <span className="text-[11px] text-muted-foreground/60 line-through leading-none">Rp {item.originalPrice}</span>
                    )}
                    <span className={`text-sm font-bold leading-none ${item.promo ? "text-primary" : ""}`}>Rp {item.price}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Kapasitas maksimal <span className="font-medium text-foreground">7 orang</span></p>
          </div>
        </section>

        {/* Fasilitas */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-facilities">
            <Headphones className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Fasilitas Studio
          </h2>
          <div className="grid grid-cols-3 gap-2.5 md:gap-3">
            {facilities.map((fac) => (
              <div
                key={fac.name}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-card border border-border/50 md:flex-row md:gap-3 md:p-4"
                data-testid={`card-facility-${fac.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-center rounded-xl bg-primary/10 p-2.5 md:p-2">
                  <fac.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[11px] font-medium text-center leading-snug md:text-sm md:text-left">{fac.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Jam Operasional */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-hours">
            <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Jam Operasional
          </h2>
          <div className="rounded-2xl overflow-hidden border border-border/60 bg-card">
            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                {studioOpen ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" data-testid="badge-status-open">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Buka
                  </Badge>
                ) : (
                  <Badge variant="destructive" data-testid="badge-status-closed">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Tutup
                  </Badge>
                )}
                {todaySchedule && todaySchedule.isOpen && (
                  <span className="text-xs text-muted-foreground">
                    {formatScheduleHours(todaySchedule.openHour, todaySchedule.closeHour)} WIB
                  </span>
                )}
              </div>
            </div>
            <div>
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const item = scheduleRaw.find((s) => s.dayOfWeek === dow);
                const dayName = DAY_NAMES[dow];
                const isCurrentDay = dow === todayDow;
                return (
                  <div
                    key={dow}
                    className={`flex items-center justify-between px-4 py-3 text-sm border-b border-border/30 last:border-0 ${
                      isCurrentDay ? "bg-primary/5" : ""
                    }`}
                    data-testid={`row-schedule-${dayName.toLowerCase()}`}
                  >
                    <span className={`font-medium ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                      {dayName}
                      {isCurrentDay && <span className="ml-1.5 text-[10px] font-normal text-primary/70">Hari ini</span>}
                    </span>
                    <span className={
                      item && !item.isOpen
                        ? "text-red-500 dark:text-red-400 text-xs"
                        : isCurrentDay ? "text-foreground font-medium text-xs" : "text-muted-foreground text-xs"
                    }>
                      {item
                        ? item.isOpen
                          ? `${formatScheduleHours(item.openHour, item.closeHour)} WIB`
                          : "Libur"
                        : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Lokasi & Kontak */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-location">
            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Lokasi
          </h2>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex items-center justify-center rounded-md bg-primary/10 p-2">
                <Navigation className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Joel Music Studio & Recording</p>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-address">
                  Kp. Bencongan Rt.00/Rw.001 No.256, Kab. Tangerang, Kelapa Dua
                </p>
                <a
                  href="https://maps.app.goo.gl/WSdVyeLfHGeDvWw89"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
                  data-testid="link-directions"
                >
                  Lihat di Google Maps
                  <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="mt-3 border-t pt-3 flex flex-wrap gap-4">
              <a
                href="https://wa.me/628991601137"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                data-testid="link-whatsapp-venue"
              >
                <Phone className="h-4 w-4" />
                +62 899-1601-137
              </a>
              <a
                href="https://instagram.com/joel_musicstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                data-testid="link-instagram"
              >
                <SiInstagram className="h-4 w-4" />
                @joel_musicstudio
              </a>
            </div>
          </Card>
        </section>

        {/* Ketentuan */}
        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2 md:text-lg md:mb-4" data-testid="text-section-terms">
            <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            Ketentuan
          </h2>
          <Card className="p-4">
            <ul className="space-y-2.5">
              {ketentuanList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" data-testid={`text-term-${i}`}>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Desktop-only bottom CTA */}
        <div className="hidden md:flex pb-4 flex-col gap-3 sm:flex-row">
          <Button className="flex-1" size="lg" onClick={() => navigate("/booking")} data-testid="button-bottom-booking">
            <Music className="mr-2 h-4 w-4" />
            Booking Sekarang
          </Button>
          <Button
            className="flex-1"
            size="lg"
            variant="outline"
            onClick={() => navigate("/history")}
            data-testid="button-bottom-history"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Riwayat Booking
          </Button>
        </div>
      </div>

      {/* ── DESKTOP FOOTER ── */}
      <footer className="hidden md:block border-t bg-card/50 py-6">
        <div className="mx-auto max-w-5xl px-4 text-center space-y-3">
          <p className="text-sm font-medium" data-testid="text-footer-brand">Joel Music Studio & Recording</p>
          <div className="flex items-center justify-center gap-4">
            <p className="text-xs text-muted-foreground" data-testid="text-footer">
              &copy; {new Date().getFullYear()} Joel Music Studio. All rights reserved.
            </p>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-auto py-1 px-2" onClick={() => navigate("/admin")} data-testid="button-footer-admin">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Admin
            </Button>
          </div>
        </div>
      </footer>

      {/* Spacer for floating tab bar clearance on mobile */}
      <div className="md:hidden pb-[76px]" />

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <MobileTabBar active="home" />
    </div>
  );
}
