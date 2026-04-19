import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  DollarSign,
  TrendingUp,
  Wrench,
  Calendar,
  Plus,
  Music,
  Clock,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  BarChart2,
  Eye,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Booking, DailyCost } from "@shared/schema";

const LAYANAN_MAP: Record<string, string> = {
  rehearsal: "Rehearsal",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu",
};

function getLayananLabel(val: string) {
  return LAYANAN_MAP[val] || val;
}

function thisMonthRange() {
  const now = new Date();
  return {
    from: format(startOfMonth(now), "yyyy-MM-dd"),
    to: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const defaultRange = thisMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<DailyCost | null>(null);
  const [costAmount, setCostAmount] = useState("");
  const [costDesc, setCostDesc] = useState("");
  const [costDate, setCostDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deleteCostTarget, setDeleteCostTarget] = useState<DailyCost | null>(null);

  const { data: bookings = [], isLoading: loadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings/range", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/range?from=${dateFrom}&to=${dateTo}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allBookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings/all"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bookings/all", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: costs = [], isLoading: loadingCosts } = useQuery<DailyCost[]>({
    queryKey: ["/api/admin/costs/range", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/range?from=${dateFrom}&to=${dateTo}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: visitStats, isLoading: loadingVisits } = useQuery<{
    today: number;
    week: number;
    month: number;
    total: number;
    byPage: { page: string; count: number }[];
    dailyLast7: { date: string; count: number }[];
    weeklyHomepage: { date: string; count: number; dayLabel: string }[];
  }>({
    queryKey: ["/api/admin/stats/visits"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats/visits", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: hourlyStats } = useQuery<{
    homepage: { hour: number; count: number }[];
    booking: { hour: number; count: number }[];
  }>({
    queryKey: ["/api/admin/stats/hourly"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats/hourly", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const addCostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/costs", {
        tanggal: costDate,
        cost: parseInt(costAmount),
        keterangan: costDesc,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/range"] });
      closeCostDialog();
      toast({ title: "Pengeluaran berhasil ditambahkan" });
    },
    onError: (error: Error) => {
      toast({ title: "Gagal menambahkan pengeluaran", description: error.message, variant: "destructive" });
    },
  });

  const updateCostMutation = useMutation({
    mutationFn: async () => {
      if (!editingCost) return;
      const res = await apiRequest("PATCH", `/api/admin/costs/${editingCost.id}`, {
        cost: parseInt(costAmount),
        keterangan: costDesc,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/range"] });
      closeCostDialog();
      toast({ title: "Pengeluaran berhasil diperbarui" });
    },
    onError: (error: Error) => {
      toast({ title: "Gagal memperbarui pengeluaran", description: error.message, variant: "destructive" });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/range"] });
      setDeleteCostTarget(null);
      toast({ title: "Pengeluaran berhasil dihapus" });
    },
    onError: (error: Error) => {
      toast({ title: "Gagal menghapus pengeluaran", description: error.message, variant: "destructive" });
    },
  });

  function openAddCost() {
    setEditingCost(null);
    setCostAmount("");
    setCostDesc("");
    setCostDate(format(new Date(), "yyyy-MM-dd"));
    setCostDialogOpen(true);
  }

  function openEditCost(cost: DailyCost) {
    setEditingCost(cost);
    setCostAmount(String(cost.cost));
    setCostDesc(cost.keterangan);
    setCostDate(cost.tanggal);
    setCostDialogOpen(true);
  }

  function closeCostDialog() {
    setCostDialogOpen(false);
    setEditingCost(null);
    setCostAmount("");
    setCostDesc("");
    setCostDate(format(new Date(), "yyyy-MM-dd"));
  }

  function handleCostSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!costAmount || !costDesc) return;
    if (editingCost) {
      updateCostMutation.mutate();
    } else {
      addCostMutation.mutate();
    }
  }

  function setThisMonth() {
    const range = thisMonthRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function setToday() {
    const today = format(new Date(), "yyyy-MM-dd");
    setDateFrom(today);
    setDateTo(today);
  }

  const confirmedBookings = bookings
    .filter((b) => b.status === "confirmed")
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  const pendapatanTotal = confirmedBookings.reduce((sum, b) => sum + b.total, 0);
  const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);
  const profit = pendapatanTotal - totalCost;

  const unconfirmedCount = allBookings.filter((b) => b.status === "pending").length;

  const isSaving = addCostMutation.isPending || updateCostMutation.isPending;

  const rangeLabel =
    dateFrom === dateTo
      ? format(new Date(dateFrom + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale })
      : `${format(new Date(dateFrom + "T00:00:00"), "dd MMM yyyy", { locale: idLocale })} – ${format(new Date(dateTo + "T00:00:00"), "dd MMM yyyy", { locale: idLocale })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-dashboard-title">Admin Dashboard</h1>
      </div>

      {unconfirmedCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4 cursor-pointer transition-colors hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-950/40 dark:hover:bg-orange-950/60"
          onClick={() => navigate("/admin/payments")}
          data-testid="alert-unconfirmed-bookings"
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">
                Booking Belum Dikonfirmasi
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Ada {unconfirmedCount} booking menunggu konfirmasi pembayaran
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 shrink-0 whitespace-nowrap">
            Lihat →
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={setToday} data-testid="button-filter-today">
            Hari Ini
          </Button>
          <Button size="sm" variant="outline" onClick={setThisMonth} data-testid="button-filter-month">
            Bulan Ini
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[130px] min-w-0 text-xs sm:text-sm sm:w-[160px]"
            data-testid="input-date-from"
          />
          <span className="text-sm text-muted-foreground shrink-0">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[130px] min-w-0 text-xs sm:text-sm sm:w-[160px]"
            data-testid="input-date-to"
          />
        </div>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>

      {loadingBookings || loadingCosts ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4 text-blue-600" />}
            label="Total Group"
            value={confirmedBookings.length}
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            label="Pendapatan"
            value={`Rp ${pendapatanTotal.toLocaleString("id-ID")}`}
          />
          <StatCard
            icon={<Wrench className="h-4 w-4 text-amber-600" />}
            label="Pengeluaran"
            value={`Rp ${totalCost.toLocaleString("id-ID")}`}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            label="Profit"
            value={`Rp ${profit.toLocaleString("id-ID")}`}
          />
        </div>
      )}

      <TodayActivity allBookings={allBookings} />

      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Statistik Pengunjung
        </h2>
        {loadingVisits ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
        ) : visitStats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Hari Ini</p>
                <p className="text-2xl font-bold">{visitStats.today}</p>
                <p className="text-[10px] text-muted-foreground">kunjungan</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">7 Hari Terakhir</p>
                <p className="text-2xl font-bold">{visitStats.week}</p>
                <p className="text-[10px] text-muted-foreground">kunjungan</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Bulan Ini</p>
                <p className="text-2xl font-bold">{visitStats.month}</p>
                <p className="text-[10px] text-muted-foreground">kunjungan</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{visitStats.total}</p>
                <p className="text-[10px] text-muted-foreground">semua waktu</p>
              </Card>
            </div>
            {visitStats.byPage.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Per Halaman (7 hari)
                </p>
                <div className="space-y-2">
                  {visitStats.byPage.map((p) => {
                    const maxCount = visitStats.byPage[0]?.count || 1;
                    const pct = Math.round((p.count / maxCount) * 100);
                    const PAGE_LABEL: Record<string, string> = {
                      "/": "Beranda",
                      "/booking": "Pilih Jadwal",
                      "/booking/form": "Form Booking",
                      "/history": "Riwayat",
                    };
                    return (
                      <div key={p.page} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                          {PAGE_LABEL[p.page] ?? p.page}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right shrink-0">{p.count}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {visitStats.weeklyHomepage && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Pengunjung Beranda Minggu Ini
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Senin – Minggu · halaman utama saja</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground leading-none">
                      {visitStats.weeklyHomepage.reduce((s, d) => s + d.count, 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">total minggu ini</p>
                  </div>
                </div>
                <div className="mt-4">
                  {(() => {
                    const data = visitStats.weeklyHomepage;
                    const maxVal = Math.max(...data.map((d) => d.count), 1);
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const BAR_H = 88;
                    const hasAny = data.some((d) => d.count > 0);
                    return (
                      <>
                        <div className="flex items-end gap-1.5">
                          {data.map((d) => {
                            const isToday = d.date === todayStr;
                            const isFuture = d.date > todayStr;
                            const barPx = d.count > 0 ? Math.max(Math.round((d.count / maxVal) * BAR_H), 5) : 0;
                            return (
                              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                                <span
                                  className={`text-[11px] font-semibold h-4 flex items-center tabular-nums ${
                                    d.count > 0 ? (isToday ? "text-primary" : "text-foreground/80") : "text-transparent select-none"
                                  }`}
                                >
                                  {d.count}
                                </span>
                                <div
                                  className="w-full rounded-t-md bg-muted/60 flex items-end overflow-hidden"
                                  style={{ height: `${BAR_H}px` }}
                                >
                                  <div
                                    className={`w-full rounded-t-md transition-all duration-500 ${
                                      isToday
                                        ? "bg-primary"
                                        : isFuture
                                        ? "bg-muted-foreground/10"
                                        : "bg-primary/40"
                                    }`}
                                    style={{ height: `${barPx}px` }}
                                  />
                                </div>
                                <span
                                  className={`text-[10px] font-semibold mt-1 ${
                                    isToday ? "text-primary" : isFuture ? "text-muted-foreground/40" : "text-muted-foreground"
                                  }`}
                                >
                                  {d.dayLabel}
                                </span>
                                <span className={`text-[8px] h-3 ${isToday ? "text-primary" : "text-transparent select-none"}`}>
                                  ●
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {!hasAny && (
                          <p className="text-xs text-muted-foreground text-center pt-3">
                            Belum ada kunjungan beranda minggu ini
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>

      {hourlyStats && (hourlyStats.homepage.length > 0 || hourlyStats.booking.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Jam Tersibuk Pengunjung
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { key: "homepage", label: "Beranda", data: hourlyStats.homepage },
                { key: "booking", label: "Pilih Jadwal (Booking)", data: hourlyStats.booking },
              ] as const
            ).map(({ key, label, data }) => {
              const maxCount = data.reduce((m, d) => Math.max(m, d.count), 0);
              const peak = data.reduce(
                (best, d) => (d.count > best.count ? d : best),
                { hour: -1, count: 0 }
              );
              const top3 = [...data].sort((a, b) => b.count - a.count).slice(0, 3);
              const fmt = (h: number) => `${String(h).padStart(2, "0")}.00`;
              const totalVisits = data.reduce((s, d) => s + d.count, 0);

              return (
                <Card key={key} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {label}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{totalVisits} total visit</span>
                  </div>

                  {peak.hour >= 0 ? (
                    <>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-3xl font-bold text-primary leading-none">{fmt(peak.hour)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">jam tersibuk • {peak.count} visit</p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap pb-0.5">
                          {top3.slice(1).map((d) => (
                            <div key={d.hour} className="text-center">
                              <p className="text-xs font-semibold">{fmt(d.hour)}</p>
                              <p className="text-[9px] text-muted-foreground">{d.count} visit</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] text-muted-foreground mb-1.5 uppercase tracking-wider">Distribusi per jam</p>
                        <div className="flex items-end gap-px h-10">
                          {Array.from({ length: 24 }, (_, h) => {
                            const found = data.find((d) => d.hour === h);
                            const count = found?.count ?? 0;
                            const isPeak = h === peak.hour;
                            const heightPct = maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 6;
                            return (
                              <div
                                key={h}
                                className="flex-1 relative group"
                                title={`${fmt(h)}: ${count} visit`}
                              >
                                <div
                                  className={`w-full rounded-sm transition-all ${
                                    isPeak
                                      ? "bg-primary"
                                      : count > 0
                                      ? "bg-primary/30"
                                      : "bg-muted"
                                  }`}
                                  style={{ height: count > 0 ? `${heightPct}%` : "4px" }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[8px] text-muted-foreground">00.00</span>
                          <span className="text-[8px] text-muted-foreground">12.00</span>
                          <span className="text-[8px] text-muted-foreground">23.00</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground py-3 text-center">Belum ada data kunjungan</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Pengeluaran</h2>
          <Button size="sm" onClick={openAddCost} data-testid="button-add-cost">
            <Plus className="mr-1 h-3 w-3" />
            Tambah
          </Button>
        </div>

        {loadingCosts ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : costs.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pengeluaran pada periode ini</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {costs.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-3 gap-3" data-testid={`card-cost-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" data-testid={`text-cost-desc-${c.id}`}>{c.keterangan}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-cost-amount-${c.id}`}>
                    {c.tanggal} • Rp {c.cost.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditCost(c)} data-testid={`button-edit-cost-${c.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteCostTarget(c)} data-testid={`button-delete-cost-${c.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!loadingBookings && confirmedBookings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-semibold">Booking Konfirmasi</h2>
            <Badge variant="secondary">{confirmedBookings.length}</Badge>
          </div>
          <div className="space-y-2">
            {confirmedBookings.map((b) => {
              const extraServices = (b.extraServices as any[] | null) || [];
              const isMultiSvc = extraServices.length > 1;
              const isCashWithDp = b.paymentMethod === "cash" && !!b.buktiTransfer;
              return (
              <Card key={b.id} className="p-3 space-y-1" data-testid={`card-booking-${b.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{b.namaBand}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCashWithDp && (
                      <Badge className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25" data-testid={`badge-dp-${b.id}`}>
                        Cash · DP ✓
                      </Badge>
                    )}
                    {!isCashWithDp && b.paymentMethod === "cash" && (
                      <Badge variant="outline" className="text-[10px]">Cash</Badge>
                    )}
                    <span className="text-sm font-bold">Rp {b.total.toLocaleString("id-ID")}</span>
                  </div>
                </div>
                {isMultiSvc ? (
                  <div className="space-y-1">
                    {extraServices.map((svc: any, i: number) => (
                      <div key={i} className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {svc.tanggal || b.tanggal}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {svc.jamMulai.toString().padStart(2, "0")}:00 - {(svc.jamMulai + svc.durasi).toString().padStart(2, "0")}:00
                        </span>
                        <span className="flex items-center gap-1">
                          <Music className="h-3 w-3" />
                          {svc.name || getLayananLabel(svc.key)}
                        </span>
                      </div>
                    ))}
                    {b.bookingId && (
                      <Badge variant="secondary" className="text-[10px]">{b.bookingId}</Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {b.tanggal}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {b.jamMulai.toString().padStart(2, "0")}:00 - {(b.jamMulai + b.durasi).toString().padStart(2, "0")}:00
                    </span>
                    <span className="flex items-center gap-1">
                      <Music className="h-3 w-3" />
                      {getLayananLabel(b.jenisLayanan)}
                    </span>
                    {b.bookingId && (
                      <Badge variant="secondary" className="text-[10px]">{b.bookingId}</Badge>
                    )}
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={costDialogOpen} onOpenChange={(open) => !open && closeCostDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCost ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCostSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal</label>
              <Input
                type="date"
                value={costDate}
                onChange={(e) => setCostDate(e.target.value)}
                data-testid="input-cost-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Keterangan</label>
              <Input
                placeholder="Contoh: Beli senar gitar"
                value={costDesc}
                onChange={(e) => setCostDesc(e.target.value)}
                data-testid="input-cost-desc"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jumlah (Rp)</label>
              <Input
                type="number"
                placeholder="50000"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                data-testid="input-cost-amount"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!costAmount || !costDesc || isSaving}
              data-testid="button-save-cost"
            >
              {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {editingCost ? "Simpan Perubahan" : "Tambah Pengeluaran"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCostTarget} onOpenChange={(open) => !open && setDeleteCostTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengeluaran</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus pengeluaran "{deleteCostTarget?.keterangan}" senilai Rp {deleteCostTarget?.cost.toLocaleString("id-ID")}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-cost">Batalkan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteCostTarget && deleteCostMutation.mutate(deleteCostTarget.id)}
              disabled={deleteCostMutation.isPending}
              data-testid="button-confirm-delete-cost"
            >
              {deleteCostMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
}) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-muted p-1.5">{icon}</div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

const STUDIO_HOURS = Array.from({ length: 14 }, (_, i) => i + 9);

const LAYANAN_LABEL: Record<string, string> = {
  rehearsal: "Rehearsal",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu",
};

function TodayActivity({ allBookings }: { allBookings: Booking[] }) {
  const [showEmptySlots, setShowEmptySlots] = useState(false);
  const currentHour = new Date().getHours();
  const today = format(new Date(), "yyyy-MM-dd");

  const todayBookings = useMemo(
    () => allBookings.filter((b) => b.tanggal === today && b.status !== "rejected"),
    [allBookings, today]
  );

  const schedule = useMemo(() => {
    return STUDIO_HOURS.map((hour) => {
      const owningBooking = todayBookings.find(
        (b) => b.jamMulai <= hour && hour < b.jamMulai + b.durasi
      );
      return {
        hour,
        booking: owningBooking ?? null,
        isBooked: !!owningBooking,
        isStart: owningBooking ? owningBooking.jamMulai === hour : false,
      };
    });
  }, [todayBookings]);

  const bookedSlots = schedule.filter((s) => s.isBooked && s.isStart);
  const emptySlots = schedule.filter((s) => !s.isBooked);
  const currentSlot = schedule.find((s) => s.hour === currentHour);
  const currentIsEmpty = currentSlot && !currentSlot.isBooked;

  const pad = (n: number) => n.toString().padStart(2, "0");
  const slotLabel = (hour: number) => `${pad(hour)}:00 – ${pad(hour + 1)}:00`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-base font-semibold whitespace-nowrap">Aktivitas Hari Ini</h2>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {format(new Date(), "dd MMM yyyy", { locale: idLocale })}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400 shrink-0" />
            {bookedSlots.length} terisi
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/25 shrink-0" />
            {emptySlots.length} kosong
          </span>
        </div>
      </div>

      {/* Section 1: Booked slots */}
      {bookedSlots.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            Terisi ({bookedSlots.length})
          </p>
          <div className="space-y-1.5">
            {bookedSlots.map(({ hour, booking }) => {
              if (!booking) return null;
              const isCurrent = hour === currentHour;
              return (
                <div
                  key={hour}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent
                      ? "border-emerald-500 bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/60"
                      : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  }`}
                  data-testid={`slot-booked-${hour}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center gap-1">
                        {slotLabel(hour)}
                        {isCurrent && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold text-white">
                            Sekarang
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-200 truncate">
                        {booking.namaBand}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        {LAYANAN_LABEL[booking.jenisLayanan] ?? booking.jenisLayanan}
                        {booking.durasi > 1 && ` · ${booking.durasi} jam`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 self-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        booking.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                      }`}
                    >
                      {booking.status === "confirmed" ? "✓ Lunas" : "⏳ Pending"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">Belum ada booking hari ini</p>
        </div>
      )}

      {/* Section 2: Current slot (only when empty) */}
      {currentIsEmpty && currentSlot && (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            Slot Sekarang
          </p>
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-700 dark:bg-amber-950/30"
            data-testid={`slot-current-${currentSlot.hour}`}
          >
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {slotLabel(currentSlot.hour)}
            </p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Kosong — tersedia sekarang</p>
          </div>
        </div>
      )}

      {/* Section 3: Empty slots (collapsible) */}
      {emptySlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
              Slot Kosong ({emptySlots.length})
            </p>
            <button
              onClick={() => setShowEmptySlots((v) => !v)}
              className="text-[11px] font-medium text-primary hover:underline active:opacity-70"
              data-testid="button-toggle-empty-slots"
            >
              {showEmptySlots ? "Tutup ↑" : "Lihat Semua ↓"}
            </button>
          </div>

          {showEmptySlots && (
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
              {emptySlots.map(({ hour }) => {
                const isCurrent = hour === currentHour;
                return (
                  <div
                    key={hour}
                    className={`rounded-md border px-2 py-1.5 text-center ${
                      isCurrent
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-muted/30"
                    }`}
                    data-testid={`slot-available-${hour}`}
                  >
                    <p className={`text-[10px] font-semibold leading-tight ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                      {pad(hour)}:00
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight">Kosong</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
