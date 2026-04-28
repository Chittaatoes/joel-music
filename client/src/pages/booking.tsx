import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/lib/seo";
import { useQuery, useQueries } from "@tanstack/react-query";
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
  Plus,
  X,
  Layers,
  CalendarDays,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  isBefore,
  startOfDay,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isToday,
  parse,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Booking, Service, PricingTier, AdditionalEquipment, ExtraServiceItem } from "@shared/schema";

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function calculateServicePrice(svc: Service, durasi: number, equipmentIds: string[] = [], allEquipment: AdditionalEquipment[] = []): number {
  if (svc.isFixedPrice && svc.fixedPrice != null) return svc.fixedPrice;
  const tiers = (svc.pricingTiers as PricingTier[] | null) || [];
  const tier = tiers.find((t) => t.hours === durasi);
  let base = tier ? tier.price : (svc.pricePerHour || 0) * durasi;
  for (const eqId of equipmentIds) {
    const eq = allEquipment.find((e) => e.id === eqId);
    if (eq) base += eq.pricePerHour * durasi;
  }
  return base;
}

function getHoursForSchedule(openHour: number, closeHour: number): number[] {
  const last = closeHour - 1;
  return Array.from({ length: last - openHour + 1 }, (_, i) => i + openHour);
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
  past: { label: "Lewat", className: "bg-muted/60 text-muted-foreground border-border/40" },
  local: { label: "Dipilih", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25" },
};

type ServiceItem = {
  id: string;
  serviceKey: string;
  tanggal: string;
  slots: number[];
  equipmentIds: string[];
};

type SlotInfo = { hour: number; status: "available" | "pending" | "confirmed" | "past" | "local" };

export default function BookingPage() {
  usePageMeta({
    title: "Pilih Jadwal Booking Studio - Joel Music Studio",
    description:
      "Pilih jadwal studio musik secara real-time. Rehearsal band, karaoke, live record, cover lagu. Slot tersedia langsung tampil, booking online dengan pembayaran QRIS.",
    path: "/booking",
  });
  const [, navigate] = useLocation();
  const today = format(new Date(), "yyyy-MM-dd");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: serviceList = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: equipmentList = [] } = useQuery<AdditionalEquipment[]>({
    queryKey: ["/api/admin/equipment"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: scheduleRaw = [] } = useQuery<{ dayOfWeek: number; isOpen: boolean; openHour: number; closeHour: number }[]>({
    queryKey: ["/api/operational-schedule"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const activeServices = serviceList;

  useMemo(() => {
    if (activeServices.length > 0 && !initialized) {
      const firstId = nanoid();
      setServiceItems([{ id: firstId, serviceKey: activeServices[0].key, tanggal: today, slots: [], equipmentIds: [] }]);
      setActiveItemId(firstId);
      setInitialized(true);
    }
  }, [activeServices, initialized, today]);

  const uniqueDates = useMemo(() => [...new Set([format(calendarDate, "yyyy-MM-dd"), ...serviceItems.map((si) => si.tanggal)])], [calendarDate, serviceItems]);

  const bookingResults = useQueries({
    queries: uniqueDates.map((date) => ({
      queryKey: ["/api/bookings/schedule/" + date],
      refetchInterval: 3000,
      enabled: serviceList.length > 0,
    })),
  });

  const bookingsByDate: Record<string, Booking[]> = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    uniqueDates.forEach((date, idx) => {
      map[date] = (bookingResults[idx]?.data as Booking[]) || [];
    });
    return map;
  }, [uniqueDates, bookingResults]);

  const isLoadingBookings = bookingResults.some((r) => r.isLoading);

  function getScheduleForDate(date: string) {
    const d = parse(date, "yyyy-MM-dd", new Date());
    const dow = d.getDay();
    return scheduleRaw.find((s) => s.dayOfWeek === dow);
  }

  const getHoursForDate = useCallback((date: string): number[] => {
    const sched = getScheduleForDate(date);
    if (!sched || !sched.isOpen) return [];
    return getHoursForSchedule(sched.openHour, sched.closeHour);
  }, [scheduleRaw]);

  const isDateClosed = useCallback((date: string): boolean => {
    const sched = getScheduleForDate(date);
    return !sched || !sched.isOpen;
  }, [scheduleRaw]);

  const calendarDateStr = format(calendarDate, "yyyy-MM-dd");
  const calendarSchedule = scheduleRaw.find((s) => s.dayOfWeek === calendarDate.getDay());
  const isCalendarDayClosed = !calendarSchedule?.isOpen;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const getLocallyReservedHoursForItem = useCallback((itemId: string, itemTanggal: string): Set<number> => {
    const reserved = new Set<number>();
    for (const item of serviceItems) {
      if (item.id === itemId || item.slots.length === 0 || item.tanggal !== itemTanggal) continue;
      const min = item.slots[0];
      const max = item.slots[item.slots.length - 1];
      for (let h = min; h <= max; h++) reserved.add(h);
    }
    return reserved;
  }, [serviceItems]);

  const getSlotInfosForItem = useCallback((itemId: string, itemTanggal: string): SlotInfo[] => {
    const now = new Date();
    const isTodayDate = itemTanggal === today;
    const currentHour = now.getHours();
    const localReserved = getLocallyReservedHoursForItem(itemId, itemTanggal);
    const hours = getHoursForDate(itemTanggal);
    const bookings = bookingsByDate[itemTanggal] || [];

    return hours.map((hour) => {
      if (isTodayDate && hour <= currentHour) return { hour, status: "past" };
      if (localReserved.has(hour)) return { hour, status: "local" };
      return { hour, status: getSlotStatus(hour, bookings) };
    });
  }, [bookingsByDate, today, getLocallyReservedHoursForItem, getHoursForDate]);

  const handleSlotClick = useCallback((itemId: string, hour: number, status: string) => {
    if (status !== "available") return;
    const item = serviceItems.find((i) => i.id === itemId);
    if (!item) return;
    const svc = activeServices.find((s) => s.key === item.serviceKey);
    const isCoverLagu = svc?.isFixedPrice ?? false;

    setServiceItems((prev) => prev.map((si) => {
      if (si.id !== itemId) return si;
      if (isCoverLagu) return { ...si, slots: [hour] };

      const newSlots = si.slots.includes(hour)
        ? si.slots.filter((h) => h !== hour)
        : [...si.slots, hour].sort((a, b) => a - b);

      if (newSlots.length <= 1) return { ...si, slots: newSlots };

      const min = newSlots[0];
      const max = newSlots[newSlots.length - 1];
      const localReserved = getLocallyReservedHoursForItem(itemId, si.tanggal);
      const bookings = bookingsByDate[si.tanggal] || [];
      const consecutive: number[] = [];
      for (let h = min; h <= max; h++) {
        if (localReserved.has(h)) return si;
        const st = getSlotStatus(h, bookings);
        if (st !== "available") return si;
        consecutive.push(h);
      }
      if (consecutive.length > 4) return si;
      return { ...si, slots: consecutive };
    }));
  }, [serviceItems, activeServices, bookingsByDate, getLocallyReservedHoursForItem]);

  const handleCalendarDateSelect = (date: Date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return;
    setCalendarDate(date);
    const newDateStr = format(date, "yyyy-MM-dd");
    setServiceItems((prev) => prev.map((si) => {
      if (si.id !== activeItemId || si.slots.length > 0) return si;
      return { ...si, tanggal: newDateStr };
    }));
  };

  const handleFocusItem = (item: ServiceItem) => {
    setActiveItemId(item.id);
    const d = parse(item.tanggal, "yyyy-MM-dd", new Date());
    setCalendarDate(d);
    setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
  };

  const handlePrevWeek = () => {
    const newStart = subDays(weekStart, 7);
    if (isBefore(endOfWeek(newStart, { weekStartsOn: 1 }), startOfDay(new Date()))) return;
    setWeekStart(newStart);
  };

  const handleNextWeek = () => setWeekStart(addDays(weekStart, 7));

  const handleServiceKeyChange = (itemId: string, key: string) => {
    setServiceItems((prev) => prev.map((si) =>
      si.id === itemId ? { ...si, serviceKey: key, slots: [], equipmentIds: [] } : si
    ));
  };

  const handleToggleEquipment = (itemId: string, eqId: string) => {
    setServiceItems((prev) => prev.map((si) => {
      if (si.id !== itemId) return si;
      return {
        ...si,
        equipmentIds: si.equipmentIds.includes(eqId)
          ? si.equipmentIds.filter((x) => x !== eqId)
          : [...si.equipmentIds, eqId],
      };
    }));
  };

  const addServiceItem = () => {
    const usedKeys = serviceItems.map((si) => si.serviceKey);
    const nextKey = activeServices.find((s) => !usedKeys.includes(s.key))?.key || activeServices[0]?.key || "";
    const newId = nanoid();
    setServiceItems((prev) => [...prev, { id: newId, serviceKey: nextKey, tanggal: calendarDateStr, slots: [], equipmentIds: [] }]);
    setActiveItemId(newId);
  };

  const removeServiceItem = (itemId: string) => {
    setServiceItems((prev) => {
      const remaining = prev.filter((si) => si.id !== itemId);
      if (activeItemId === itemId && remaining.length > 0) {
        const fallback = remaining[remaining.length - 1];
        setActiveItemId(fallback.id);
        const d = parse(fallback.tanggal, "yyyy-MM-dd", new Date());
        setCalendarDate(d);
        setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
      }
      return remaining;
    });
  };

  const canAddMore = useMemo(() => {
    const allHaveSlots = serviceItems.every((si) => si.slots.length > 0);
    return allHaveSlots && serviceItems.length < activeServices.length && serviceItems.length < 4;
  }, [serviceItems, activeServices]);

  const grandTotal = useMemo(() => {
    return serviceItems.reduce((sum, si) => {
      const svc = activeServices.find((s) => s.key === si.serviceKey);
      if (!svc) return sum;
      const durasi = svc.isFixedPrice ? 1 : si.slots.length;
      if (durasi === 0) return sum;
      return sum + calculateServicePrice(svc, durasi, si.equipmentIds, equipmentList);
    }, 0);
  }, [serviceItems, activeServices, equipmentList]);

  const allItemsHaveSlots = serviceItems.length > 0 && serviceItems.every((si) => si.slots.length > 0);

  const handleProceed = () => {
    if (!allItemsHaveSlots) return;

    const extraServicesData: ExtraServiceItem[] = serviceItems.map((si) => {
      const svc = activeServices.find((s) => s.key === si.serviceKey)!;
      const durasi = svc.isFixedPrice ? 1 : si.slots.length;
      const subtotal = calculateServicePrice(svc, durasi, si.equipmentIds, equipmentList);
      return {
        key: si.serviceKey,
        name: svc.name,
        tanggal: si.tanggal,
        jamMulai: si.slots[0],
        durasi,
        selectedEquipmentIds: si.equipmentIds,
        withKeyboard: false,
        subtotal,
      };
    });

    const primaryService = extraServicesData[0];
    const sessionTanggal = primaryService.tanggal || calendarDateStr;

    sessionStorage.setItem("jms_multi_booking", JSON.stringify({
      tanggal: sessionTanggal,
      services: extraServicesData,
      grandTotal,
    }));

    const params = new URLSearchParams({
      tanggal: sessionTanggal,
      jam: String(primaryService.jamMulai),
      durasi: String(primaryService.durasi),
      layanan: primaryService.key,
      multi: serviceItems.length > 1 ? "1" : "0",
    });
    if (primaryService.selectedEquipmentIds.length > 0) {
      params.set("equipment", primaryService.selectedEquipmentIds.join(","));
    }
    navigate(`/booking/form?${params.toString()}`);
  };

  const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  if (loadingServices) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
              <span className="font-semibold text-sm">Pilih Jadwal</span>
            </div>
          </div>
        </nav>
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
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

        {/* ── CALENDAR ────────────────────────────────── */}
        <section>
          <Card className="p-4">
            {serviceItems.length > 1 && activeItemId && (() => {
              const activeItem = serviceItems.find((si) => si.id === activeItemId);
              const activeSvc = activeItem ? activeServices.find((s) => s.key === activeItem.serviceKey) : null;
              const locked = activeItem && activeItem.slots.length > 0;
              return (
                <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md text-xs ${locked ? "bg-muted/40 text-muted-foreground" : "bg-primary/8 text-primary"}`}>
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {locked
                      ? `Tanggal ${activeSvc?.name ?? ""} sudah terkunci`
                      : `Pilih tanggal untuk: ${activeSvc?.name ?? ""}`}
                  </span>
                </div>
              );
            })()}
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
                const isSelected = isSameDay(day, calendarDate);
                const isTodayDate = isToday(day);
                const dayStr = format(day, "yyyy-MM-dd");
                const hasServiceOnDay = serviceItems.some((si) => si.tanggal === dayStr && si.slots.length > 0);
                return (
                  <button
                    key={idx}
                    disabled={isPast}
                    onClick={() => handleCalendarDateSelect(day)}
                    className={`relative flex flex-col items-center gap-1 rounded-md py-2 px-1 transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isPast
                        ? "opacity-40 cursor-not-allowed"
                        : "hover-elevate cursor-pointer"
                    }`}
                    data-testid={`date-${dayStr}`}
                  >
                    <span className={`text-[11px] font-medium ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {dayLabels[idx]}
                    </span>
                    <span className={`text-base font-semibold leading-none ${isTodayDate && !isSelected ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {hasServiceOnDay && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-emerald-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <p className="mt-2 text-sm text-muted-foreground text-center" data-testid="text-selected-date">
            {format(calendarDate, "EEEE, dd MMMM yyyy", { locale: idLocale })}
          </p>
        </section>

        {/* ── LEGEND ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {(["available", "pending", "confirmed"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                key === "available" ? "bg-emerald-500" :
                key === "pending" ? "bg-amber-500" : "bg-red-500"
              }`} />
              <span className="text-xs text-muted-foreground">{statusConfig[key].label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span className="text-xs text-muted-foreground">Dipilih layanan lain</span>
          </div>
        </div>

        {/* ── SERVICE ITEMS ────────────────────────────── */}
        <div className="space-y-5">
          {serviceItems.map((item, idx) => {
            const svc = activeServices.find((s) => s.key === item.serviceKey);
            const isCoverLagu = svc?.isFixedPrice ?? false;
            const durasi = isCoverLagu ? 1 : item.slots.length;
            const subtotal = svc ? calculateServicePrice(svc, durasi, item.equipmentIds, equipmentList) : 0;
            const jamMulai = item.slots.length > 0 ? item.slots[0] : null;
            const jamSelesai = jamMulai !== null ? jamMulai + durasi : null;
            const itemClosed = isDateClosed(item.tanggal);

            const availableEquipment = equipmentList.filter((eq) => {
              const serviceKeys = (eq.serviceKeys as string[] | null) || [];
              return eq.isActive && serviceKeys.includes(item.serviceKey);
            });

            const slotInfos = itemClosed ? [] : getSlotInfosForItem(item.id, item.tanggal);
            const itemDateFormatted = format(parse(item.tanggal, "yyyy-MM-dd", new Date()), "EEE, dd MMM yyyy", { locale: idLocale });

            const isActive = item.id === activeItemId;
            return (
              <Card
                key={item.id}
                className={`p-4 space-y-4 transition-all cursor-pointer ${isActive ? "ring-2 ring-primary/40 border-primary/30" : "border-border/60"}`}
                onClick={() => handleFocusItem(item)}
                data-testid={`card-service-${idx}`}
              >
                {/* Service header */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    <span className="text-xs font-bold">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <Select value={item.serviceKey} onValueChange={(val) => handleServiceKeyChange(item.id, val)}>
                      <SelectTrigger data-testid={`select-layanan-${idx}`} className="h-9">
                        <SelectValue placeholder="Pilih layanan" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeServices.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {serviceItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeServiceItem(item.id); }}
                      data-testid={`button-remove-service-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Date display for this service */}
                <div className="flex items-center gap-2 pl-8">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={`text-sm font-medium ${item.slots.length > 0 ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {itemDateFormatted}
                  </span>
                  {item.slots.length === 0 && isActive && (
                    <span className="text-xs text-primary/70 ml-1">← ubah dari kalender</span>
                  )}
                </div>

                {svc?.isFixedPrice && svc.note && (
                  <p className="text-xs text-muted-foreground pl-8">{svc.note}</p>
                )}

                {/* Equipment checkboxes */}
                {availableEquipment.length > 0 && (
                  <div className="pl-8 space-y-2">
                    {availableEquipment.map((eq) => (
                      <div key={eq.id} className="flex items-center gap-2.5">
                        <Checkbox
                          id={`eq-${item.id}-${eq.id}`}
                          checked={item.equipmentIds.includes(eq.id)}
                          onCheckedChange={() => handleToggleEquipment(item.id, eq.id)}
                          data-testid={`checkbox-equipment-${idx}-${eq.id}`}
                        />
                        <label htmlFor={`eq-${item.id}-${eq.id}`} className="text-sm cursor-pointer select-none">
                          {eq.name} <span className="text-muted-foreground">(+Rp {eq.pricePerHour.toLocaleString("id-ID")}/jam)</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {/* Time slots section */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {isCoverLagu ? "Pilih Jam Sesi" : "Pilih Jam"}
                  </p>

                  {itemClosed ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground">Studio tutup pada tanggal ini</p>
                      <p className="text-xs text-muted-foreground mt-1">Pilih tanggal lain dari kalender di atas</p>
                    </div>
                  ) : isLoadingBookings ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-md" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slotInfos.map(({ hour, status }) => {
                        const isSelected = item.slots.includes(hour);
                        const cfg = statusConfig[status];
                        const perHourPrice = svc ? (svc.pricePerHour || 0) + item.equipmentIds.reduce((s, id) => {
                          const eq = equipmentList.find((e) => e.id === id);
                          return s + (eq?.pricePerHour || 0);
                        }, 0) : 0;
                        return (
                          <button
                            key={hour}
                            disabled={status !== "available"}
                            onClick={() => handleSlotClick(item.id, hour, status)}
                            className={`relative flex flex-col items-center justify-center rounded-md border p-3 text-sm transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : status === "available"
                                ? "border-border hover-elevate cursor-pointer"
                                : `${cfg.className} cursor-not-allowed opacity-60`
                            }`}
                            data-testid={`slot-${idx}-${hour}`}
                          >
                            <span className="font-medium">{`${hour.toString().padStart(2, "0")}:00`}</span>
                            <span className="text-[10px] mt-0.5 text-muted-foreground">
                              {status === "available"
                                ? isCoverLagu
                                  ? svc?.fixedPrice ? `${Math.round(svc.fixedPrice / 1000)}K` : "-"
                                  : `Rp ${Math.round(perHourPrice / 1000)}k`
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
                </div>

                {/* Selected time summary for this service */}
                {item.slots.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-wrap items-center gap-2 text-sm flex-1">
                      <span className="font-medium text-primary">
                        {isCoverLagu
                          ? `Sesi: ${jamMulai?.toString().padStart(2, "0")}:00`
                          : `${jamMulai?.toString().padStart(2, "0")}:00 – ${jamSelesai?.toString().padStart(2, "0")}:00`}
                      </span>
                      {!isCoverLagu && <Badge variant="secondary">{durasi} jam</Badge>}
                      <span className="ml-auto font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Add service button */}
          {canAddMore && (
            <Button
              variant="outline"
              className="w-full border-dashed gap-2"
              onClick={addServiceItem}
              data-testid="button-add-service"
            >
              <Plus className="h-4 w-4" />
              Tambah Layanan Lain
            </Button>
          )}
        </div>
      </div>

      {/* ── STICKY BOTTOM SUMMARY ──────────────────────── */}
      {allItemsHaveSlots && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-background/95 backdrop-blur-md border-t">
          <div className="mx-auto max-w-5xl">
            <Card className="border-primary/25 p-4">
              {/* Multi-service chart */}
              {serviceItems.length > 1 && (
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ringkasan Booking</span>
                  </div>
                  {serviceItems.map((si, idx) => {
                    const svc = activeServices.find((s) => s.key === si.serviceKey);
                    if (!svc || si.slots.length === 0) return null;
                    const isCoverLagu = svc.isFixedPrice ?? false;
                    const durasi = isCoverLagu ? 1 : si.slots.length;
                    const subtotal = calculateServicePrice(svc, durasi, si.equipmentIds, equipmentList);
                    const jamMulai = si.slots[0];
                    const jamSelesai = jamMulai + durasi;
                    const itemDate = format(parse(si.tanggal, "yyyy-MM-dd", new Date()), "dd MMM", { locale: idLocale });
                    const eqNames = si.equipmentIds.map((id) => equipmentList.find((e) => e.id === id)?.name).filter(Boolean) as string[];
                    return (
                      <div key={si.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold">{idx + 1}</span>
                            </div>
                            <span className="font-medium truncate">{svc.name}</span>
                            <span className="text-muted-foreground text-xs shrink-0">
                              {itemDate} · {isCoverLagu
                                ? `${jamMulai.toString().padStart(2, "0")}:00`
                                : `${jamMulai.toString().padStart(2, "0")}:00–${jamSelesai.toString().padStart(2, "0")}:00`}
                            </span>
                          </div>
                          <span className="font-medium shrink-0">Rp {subtotal.toLocaleString("id-ID")}</span>
                        </div>
                        {eqNames.length > 0 && (
                          <div className="pl-6 flex flex-wrap gap-1">
                            {eqNames.map((name) => (
                              <span key={name} className="text-[10px] bg-primary/10 text-primary font-medium rounded-full px-2 py-0.5">+ {name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="border-t mt-1 pt-1.5 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium">Total</span>
                    <span className="font-bold text-base">Rp {grandTotal.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              )}

              {/* Single service summary */}
              {serviceItems.length === 1 && (() => {
                const si = serviceItems[0];
                const svc = activeServices.find((s) => s.key === si.serviceKey);
                if (!svc || si.slots.length === 0) return null;
                const isCoverLagu = svc.isFixedPrice ?? false;
                const durasi = isCoverLagu ? 1 : si.slots.length;
                const jamMulai = si.slots[0];
                const jamSelesai = jamMulai + durasi;
                const eqNames = si.equipmentIds.map((id) => equipmentList.find((e) => e.id === id)?.name).filter(Boolean) as string[];
                return (
                  <div className="mb-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium" data-testid="text-booking-summary">
                        {isCoverLagu
                          ? `Sesi: ${jamMulai.toString().padStart(2, "0")}:00`
                          : `${jamMulai.toString().padStart(2, "0")}:00 – ${jamSelesai.toString().padStart(2, "0")}:00`}
                      </span>
                      {!isCoverLagu && <Badge variant="secondary" data-testid="badge-duration">{durasi} jam</Badge>}
                      <span className="ml-auto text-lg font-bold" data-testid="text-booking-total">
                        Rp {grandTotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                    {eqNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-6">
                        {eqNames.map((name) => (
                          <span key={name} className="text-[10px] bg-primary/10 text-primary font-medium rounded-full px-2 py-0.5">+ {name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <Button className="w-full" onClick={handleProceed} data-testid="button-proceed">
                Lanjutkan
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
