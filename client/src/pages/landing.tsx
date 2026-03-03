import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
const logoImage = "/images/logo.png";
const heroImage = "/images/hero-studio.png";

function isRamadan(): boolean {
  const now = new Date();
  const ramadanPeriods = [
    { start: new Date(2026, 1, 17), end: new Date(2026, 2, 19) },
    { start: new Date(2027, 1, 7), end: new Date(2027, 2, 9) },
    { start: new Date(2028, 0, 27), end: new Date(2028, 1, 26) },
  ];
  return ramadanPeriods.some((p) => now >= p.start && now <= p.end);
}

const operationalHours = [
  { day: "Senin", hours: "09:00 - 23:00" },
  { day: "Selasa", hours: "09:00 - 23:00" },
  { day: "Rabu", hours: "09:00 - 23:00" },
  { day: "Kamis", hours: "09:00 - 23:00" },
  { day: "Jumat", hours: "09:00 - 23:00" },
  { day: "Sabtu", hours: "09:00 - 00:00" },
  { day: "Minggu", hours: "09:00 - 00:00" },
];

function getToday() {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[new Date().getDay()];
}

function isStudioOpen() {
  const now = new Date();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const closeHour = isWeekend ? 24 : 23;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= 9 * 60 && currentMinutes < closeHour * 60;
}

const layanan = [
  { name: "Rehearsal / Latihan", desc: "Latihan band dengan alat lengkap", icon: Music },
  { name: "Live Record", desc: "Rekaman live langsung di studio", icon: Disc3 },
  { name: "Karaoke", desc: "Karaoke dengan sound system pro", icon: MicVocal },
  { name: "Cover Lagu / Minus One", desc: "Cover lagu dengan tuning vocal & mixing", icon: Headphones },
  { name: "Sewa Keyboard", desc: "Tambahan keyboard saat rehearsal", icon: Keyboard },
  { name: "Sewa Alat Musik", desc: "Rental drum, gitar, bass, dll", icon: Package },
];

const priceList = [
  { name: "Karaoke 1 Jam", price: "55K", note: null, promo: false, originalPrice: null },
  { name: "Karaoke 2 Jam", price: "100K", note: "Hemat Rp 10.000!", promo: true, originalPrice: "110K" },
  { name: "Rehearsal / Latihan 1 Jam", price: "65K", note: null, promo: false, originalPrice: null },
  { name: "Rehearsal / Latihan 3 Jam", price: "190K", note: "Hemat Rp 5.000!", promo: false, originalPrice: "195K" },
  { name: "Live Record", price: isRamadan() ? "80K" : "100K", note: isRamadan() ? "Per jam. Promo Ramadhan! Output: master lagu WAV" : "Per jam. Output: master lagu WAV", promo: isRamadan(), originalPrice: isRamadan() ? "100K" : null },
  { name: "Cover Lagu / Minus One", price: "500K", note: "Maks 3 track vocal, 1x revisi, include tuning vocal & mixing. Output: master WAV + video", promo: false, originalPrice: null },
];

const facilities = [
  { name: "Drum Set", icon: Drum },
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
  "Kapasitas maksimal studio adalah 6 orang",
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const todayName = getToday();
  const studioOpen = isStudioOpen();
  const todaySchedule = operationalHours.find((h) => h.day === todayName);

  return (
    <div className="min-h-screen bg-background">
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
              Mulai dari Rp 55.000
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
            {layanan.map((item) => (
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

        <section>
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2" data-testid="text-section-pricing">
            <Music className="h-5 w-5 text-muted-foreground" />
            Daftar Harga
          </h2>
          <Card className="p-0 overflow-hidden">
            {priceList.map((item, i) => (
              <div
                key={item.name}
                className={`flex items-start justify-between gap-3 px-4 py-3 ${i < priceList.length - 1 ? "border-b" : ""} ${item.promo ? "bg-[hsl(45_85%_55%/0.08)]" : ""}`}
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
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Kapasitas maksimal <span className="font-medium text-foreground">6 orang</span></p>
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
                {todaySchedule && (
                  <span className="text-sm text-muted-foreground">{todaySchedule.hours} WIB</span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {operationalHours.map((item) => {
                const isCurrentDay = item.day === todayName;
                return (
                  <div
                    key={item.day}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                      isCurrentDay ? "bg-primary/8 font-medium" : ""
                    }`}
                    data-testid={`row-schedule-${item.day.toLowerCase()}`}
                  >
                    <span className={isCurrentDay ? "text-foreground" : "text-muted-foreground"}>
                      {item.day}
                    </span>
                    <span className={isCurrentDay ? "text-foreground" : "text-muted-foreground"}>
                      {item.hours} WIB
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
