import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
const logoImage = "/images/logo.png";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { format, addDays, subDays, isBefore, startOfDay, isSameDay, startOfWeek, endOfWeek, isToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Booking } from "@shared/schema";

function isRamadan(): boolean {
  const now = new Date();
  const ramadanPeriods = [
    { start: new Date(2026, 1, 17), end: new Date(2026, 2, 19) },
    { start: new Date(2027, 1, 7), end: new Date(2027, 2, 9) },
    { start: new Date(2028, 0, 27), end: new Date(2028, 1, 26) },
  ];
  return ramadanPeriods.some((p) => now >= p.start && now <= p.end);
}

const LAYANAN_OPTIONS = [
  { value: "rehearsal", label: "Rehearsal / Latihan", priceLabel: "65K/jam • 3 jam 190K" },
  { value: "karaoke", label: "Karaoke", priceLabel: "55K/jam • 2 jam 100K" },
  { value: "live_recording", label: "Live Record", priceLabel: isRamadan() ? "80K/jam (Promo Ramadhan)" : "100K/jam" },
  { value: "cover_lagu", label: "Cover Lagu / Minus One", priceLabel: "500K (include video)" },
];

function getLiveRecordPrice(): number {
  return isRamadan() ? 80000 : 100000;
}

function calculatePrice(service: string, durasi: number, withKeyboard: boolean = false): number {
  let base = 0;
  switch (service) {
    case "rehearsal":
      base = durasi === 3 ? 190000 : durasi * 65000;
      if (withKeyboard) base += durasi * 10000;
      return base;
    case "karaoke":
      if (durasi === 2) return 100000;
      return durasi * 55000;
    case "live_recording":
      return durasi * getLiveRecordPrice();
    case "cover_lagu":
      return 500000;
    default:
      return durasi * 65000;
  }
}

function getPerHourPrice(service: string): number {
  switch (service) {
    case "rehearsal": return 65000;
    case "karaoke": return 55000;
    case "live_recording": return getLiveRecordPrice();
    default: return 65000;
  }
}

function getHoursForDate(date: Date): number[] {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const lastHour = isWeekend ? 23 : 22;
  return Array.from({ length: lastHour - 9 + 1 }, (_, i) => i + 9);
}

function getSlotStatus(hour: number, bookings: Booking[]): "available" | "pending" | "confirmed" {
  for (const b of bookings) {
    const start = b.jamMulai;
    const end = start + b.durasi;
    if (hour >= start && hour < end) {
      if (b.status === "confirmed") return "confirmed";
      if (b.status === "pending") return "pending";
    }
  }
  return "available";
}

const statusConfig = {
  available: { label: "Tersedia", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" },
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25" },
  confirmed: { label: "Terisi", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25" },
};

export default function BookingPage() {
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [selectedLayanan, setSelectedLayanan] = useState("rehearsal");
  const [withKeyboard, setWithKeyboard] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isCoverLagu = selectedLayanan === "cover_lagu";

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/bookings/schedule/" + dateStr],
    refetchInterval: 3000,
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const hours = useMemo(() => getHoursForDate(selectedDate), [selectedDate]);

  const slotStatuses = useMemo(() => {
    return hours.map((hour) => ({
      hour,
      status: getSlotStatus(hour, bookings),
    }));
  }, [bookings, hours]);

  const handleSlotClick = (hour: number, status: string) => {
    if (status !== "available") return;

    if (isCoverLagu) {
      setSelectedSlots([hour]);
      return;
    }

    setSelectedSlots((prev) => {
      if (prev.includes(hour)) return prev.filter((h) => h !== hour);
      const newSlots = [...prev, hour].sort((a, b) => a - b);
      if (newSlots.length <= 1) return newSlots;
      const min = newSlots[0];
      const max = newSlots[newSlots.length - 1];
      const consecutive: number[] = [];
      for (let h = min; h <= max; h++) {
        const slotStatus = getSlotStatus(h, bookings);
        if (slotStatus !== "available") return prev;
        consecutive.push(h);
      }
      if (consecutive.length > 4) return prev;
      return consecutive;
    });
  };

  const handleDateSelect = (date: Date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return;
    setSelectedDate(date);
    setSelectedSlots([]);
  };

  const handlePrevWeek = () => {
    const newStart = subDays(weekStart, 7);
    if (isBefore(endOfWeek(newStart, { weekStartsOn: 1 }), startOfDay(new Date()))) return;
    setWeekStart(newStart);
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const handleLayananChange = (val: string) => {
    setSelectedLayanan(val);
    setSelectedSlots([]);
    if (val !== "rehearsal") setWithKeyboard(false);
  };

  const totalDurasi = isCoverLagu ? 1 : selectedSlots.length;
  const totalHarga = calculatePrice(selectedLayanan, totalDurasi, withKeyboard);
  const jamMulai = selectedSlots.length > 0 ? selectedSlots[0] : null;

  const handleProceed = () => {
    if (jamMulai === null || selectedSlots.length === 0) return;
    const params = new URLSearchParams({
      tanggal: dateStr,
      jam: String(jamMulai),
      durasi: String(totalDurasi),
      layanan: selectedLayanan,
    });
    if (withKeyboard) params.set("keyboard", "1");
    navigate(`/booking/form?${params.toString()}`);
  };

  const perHourPrice = getPerHourPrice(selectedLayanan) + (withKeyboard && selectedLayanan === "rehearsal" ? 10000 : 0);
  const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-semibold text-sm">Pilih Jadwal</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Pilih Layanan
          </h2>
          <Select value={selectedLayanan} onValueChange={handleLayananChange}>
            <SelectTrigger data-testid="select-booking-layanan">
              <SelectValue placeholder="Pilih layanan" />
            </SelectTrigger>
            <SelectContent>
              {LAYANAN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">({opt.priceLabel})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCoverLagu && (
            <p className="mt-2 text-xs text-muted-foreground">
              Maks 3 track vocal, 1x revisi balancing & frequency, include tuning vocal & mixing. Output: master lagu WAV.
            </p>
          )}
          {selectedLayanan === "rehearsal" && (
            <div className="mt-3 flex items-center gap-2.5">
              <Checkbox
                id="keyboard"
                checked={withKeyboard}
                onCheckedChange={(checked) => setWithKeyboard(checked === true)}
                data-testid="checkbox-keyboard"
              />
              <label htmlFor="keyboard" className="text-sm cursor-pointer select-none">
                Keyboard <span className="text-muted-foreground">(+Rp 10.000/jam)</span>
              </label>
            </div>
          )}
        </section>

        <section>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={handlePrevWeek} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold" data-testid="text-month-year">
                {format(weekDays[3], "MMMM yyyy", { locale: idLocale })}
              </h2>
              <Button variant="ghost" size="icon" onClick={handleNextWeek} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, idx) => {
                const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                return (
                  <button
                    key={idx}
                    disabled={isPast}
                    onClick={() => handleDateSelect(day)}
                    className={`flex flex-col items-center gap-1 rounded-md py-2 px-1 transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isPast
                        ? "opacity-40 cursor-not-allowed"
                        : "hover-elevate cursor-pointer"
                    }`}
                    data-testid={`date-${format(day, "yyyy-MM-dd")}`}
                  >
                    <span className={`text-[11px] font-medium ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {dayLabels[idx]}
                    </span>
                    <span className={`text-base font-semibold leading-none ${isTodayDate && !isSelected ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
          <p className="mt-2 text-sm text-muted-foreground text-center" data-testid="text-selected-date">
            {format(selectedDate, "EEEE, dd MMMM yyyy", { locale: idLocale })}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isCoverLagu ? "Pilih Jam Sesi" : "Pilih Jam"}
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(statusConfig).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                  key === "available" ? "bg-emerald-500" :
                  key === "pending" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <span className="text-xs text-muted-foreground">{val.label}</span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slotStatuses.map(({ hour, status }) => {
                const isSelected = selectedSlots.includes(hour);
                const cfg = statusConfig[status];
                return (
                  <button
                    key={hour}
                    disabled={status !== "available"}
                    onClick={() => handleSlotClick(hour, status)}
                    className={`relative flex flex-col items-center justify-center rounded-md border p-3 text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : status === "available"
                        ? "border-border hover-elevate cursor-pointer"
                        : `${cfg.className} cursor-not-allowed opacity-60`
                    }`}
                    data-testid={`slot-${hour}`}
                  >
                    <span className="font-medium">{`${hour.toString().padStart(2, "0")}:00`}</span>
                    <span className="text-[10px] mt-0.5 text-muted-foreground">
                      {status === "available"
                        ? isCoverLagu
                          ? "300K"
                          : `Rp ${(perHourPrice / 1000).toFixed(0)}k`
                        : cfg.label}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="absolute top-1 right-1 h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedSlots.length > 0 && (
          <Card className="sticky bottom-4 z-40 border-primary/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-booking-summary">
                    {isCoverLagu
                      ? `Sesi: ${jamMulai?.toString().padStart(2, "0")}:00`
                      : `${jamMulai?.toString().padStart(2, "0")}:00 - ${((jamMulai ?? 0) + totalDurasi).toString().padStart(2, "0")}:00`}
                  </span>
                  {!isCoverLagu && <Badge variant="secondary" data-testid="badge-duration">{totalDurasi} jam</Badge>}
                </div>
                <p className="text-lg font-bold" data-testid="text-booking-total">
                  Rp {totalHarga.toLocaleString("id-ID")}
                </p>
              </div>
              <Button onClick={handleProceed} data-testid="button-proceed">
                Lanjutkan
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
