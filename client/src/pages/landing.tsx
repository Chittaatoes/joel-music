import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StudioGallery from "@/components/studio-gallery";
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

      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-semibold text-sm" data-testid="text-brand">Joel Music Studio</span>
          </div>
          <div className="flex items-center gap-2">
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

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Joel Music Studio"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-4 bg-white/15 text-white border-white/20" data-testid="badge-price">
              Mulai dari Rp {lowestPrice}
            </Badge>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl" data-testid="text-hero-title">
              Joel Music Studio & Recording
            </h1>
            <p className="mb-6 text-base text-white/80 sm:text-lg">
              Studio musik profesional di Tangerang. Rehearsal, Recording, Karaoke, dan Sewa Alat Musik.
              Booking online, bayar mudah via QRIS.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate("/booking")} data-testid="button-hero-booking">
                Booking Sekarang
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white/25 backdrop-blur-sm"
                onClick={() => {
                  document.getElementById("info-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                data-testid="button-hero-info"
              >
                Lihat Info Studio
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div id="info-section" className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-services">
            <Music className="h-5 w-5 text-muted-foreground" />
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

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-pricing">
            <Music className="h-5 w-5 text-muted-foreground" />
            Daftar Harga
          </h2>
          {loadingServices ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <Card className="p-0 overflow-hidden">
              {priceRows.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className={`flex items-start justify-between gap-3 px-4 py-3 ${i < priceRows.length - 1 ? "border-b" : ""} ${item.promo ? "bg-[hsl(45_85%_55%/0.08)]" : ""}`}
                  data-testid={`row-price-${i}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.promo && (
                        <Badge className="bg-[hsl(45_85%_55%)] text-black text-[10px] px-1.5 py-0 leading-4 no-default-hover-elevate no-default-active-elevate" data-testid="badge-promo">
                          PROMO
                        </Badge>
                      )}
                    </div>
                    {item.note && (
                      <p className={`text-xs mt-0.5 ${item.promo ? "text-[hsl(45_85%_65%)] font-medium" : "text-muted-foreground"}`}>{item.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.originalPrice && (
                      <span className="text-xs text-muted-foreground line-through">Rp {item.originalPrice}</span>
                    )}
                    <span className={`text-sm font-bold ${item.promo ? "text-[hsl(45_85%_65%)]" : ""}`}>Rp {item.price}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Kapasitas maksimal <span className="font-medium text-foreground">7 orang</span></p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-facilities">
            <Headphones className="h-5 w-5 text-muted-foreground" />
            Fasilitas Studio
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facilities.map((fac) => (
              <Card key={fac.name} className="flex items-center gap-3 p-4" data-testid={`card-facility-${fac.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
                  <fac.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">{fac.name}</span>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-hours">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Jam Operasional
          </h2>
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                  <span className="text-sm text-muted-foreground">
                    {formatScheduleHours(todaySchedule.openHour, todaySchedule.closeHour)} WIB
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const item = scheduleRaw.find((s) => s.dayOfWeek === dow);
                const dayName = DAY_NAMES[dow];
                const isCurrentDay = dow === todayDow;
                return (
                  <div
                    key={dow}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                      isCurrentDay ? "bg-primary/8 font-medium" : ""
                    }`}
                    data-testid={`row-schedule-${dayName.toLowerCase()}`}
                  >
                    <span className={isCurrentDay ? "text-foreground" : "text-muted-foreground"}>
                      {dayName}
                    </span>
                    <span className={
                      item && !item.isOpen
                        ? "text-red-500 dark:text-red-400"
                        : isCurrentDay ? "text-foreground" : "text-muted-foreground"
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
          </Card>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-location">
            <MapPin className="h-5 w-5 text-muted-foreground" />
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

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-terms">
            <FileText className="h-5 w-5 text-muted-foreground" />
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

        <div className="pb-4 flex flex-col gap-3 sm:flex-row">
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

      <footer className="border-t bg-card/50 py-6">
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
    </div>
  );
}
