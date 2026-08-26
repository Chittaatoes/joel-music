import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/lib/seo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  Phone,
  Music,
  Banknote,
  CreditCard,
  CalendarDays,
  Trash2,
} from "lucide-react";
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
const logoImage = "/images/logo.png";

export interface BookingHistoryItem {
  bookingId: string;
  namaBand: string;
  noWa: string;
  jenisLayanan: string;
  tanggal: string;
  jamMulai: number;
  durasi: number;
  total: number;
  paymentMethod: string;
  withKeyboard: boolean;
  status: string;
  createdAt: string;
}

const STORAGE_KEY = "jms_booking_history";

const LAYANAN_MAP: Record<string, string> = {
  rehearsal: "Rehearsal",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu Verifikasi", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25" },
  confirmed: { label: "Disetujui", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" },
  rejected: { label: "Ditolak", className: "bg-muted text-muted-foreground border-muted" },
};

export function getBookingHistory(): BookingHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveBookingToHistory(item: BookingHistoryItem) {
  const history = getBookingHistory();
  history.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export default function HistoryPage() {
  usePageMeta({
    title: "Riwayat Booking - Joel Music Studio",
    description:
      "Lihat riwayat booking studio musik kamu dan status pembayaran terbaru.",
    path: "/history",
  });
  const [, navigate] = useLocation();
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const items = getBookingHistory();
    setHistory(items);

    const bookingIds = items.map((i) => i.bookingId).filter(Boolean);
    if (bookingIds.length > 0) {
      fetch("/api/bookings/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds }),
      })
        .then((res) => res.json())
        .then((statuses: { bookingId: string; status: string }[]) => {
          if (!Array.isArray(statuses) || statuses.length === 0) return;
          const statusMap = new Map(statuses.map((s) => [s.bookingId, s.status]));
          const updated = items.map((item) => {
            const newStatus = statusMap.get(item.bookingId);
            return newStatus ? { ...item, status: newStatus } : item;
          });
          setHistory(updated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        })
        .catch(() => {});
    }
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    setClearConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-[#F0FAFB] dark:from-slate-950 dark:via-slate-950 dark:to-[#102F35]">
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-semibold text-sm" data-testid="text-brand">Riwayat Booking</span>
          </div>
          {history.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setClearConfirm(true)}
              data-testid="button-clear-history"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Hapus Semua
            </Button>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        {history.length === 0 ? (
          <Card className="relative isolate overflow-hidden border-0 bg-gradient-to-br from-[#101C22] via-[#153D45] to-[#0F6975] text-white shadow-[0_20px_50px_-20px_rgba(13,115,127,0.45)]" data-testid="empty-history">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#70E5EA]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-[#0E8794]/20 blur-3xl" />
            <div className="relative p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#8BEFF2]/30 bg-[#8BEFF2]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#BDF7F8]">
                  <Music className="h-3.5 w-3.5" />
                  Studio siap dipakai
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                  <CalendarDays className="h-6 w-6 text-[#8BEFF2]" />
                </div>
              </div>

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#8BEFF2]/80">Booking pertama kamu</p>
              <h1 className="max-w-md text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Siap bikin sesi musik yang berkesan?
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#D5E6E8]">
                Pilih jadwal studio, amankan slotnya, lalu nikmati waktumu untuk latihan, rekaman, atau berkarya.
              </p>

              <div className="mt-7 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5 py-3">
                <div className="px-2 text-center">
                  <CalendarDays className="mx-auto mb-1.5 h-4 w-4 text-[#8BEFF2]" />
                  <p className="text-[11px] font-semibold text-white">Pilih jadwal</p>
                </div>
                <div className="px-2 text-center">
                  <Banknote className="mx-auto mb-1.5 h-4 w-4 text-[#8BEFF2]" />
                  <p className="text-[11px] font-semibold text-white">Bayar mudah</p>
                </div>
                <div className="px-2 text-center">
                  <Music className="mx-auto mb-1.5 h-4 w-4 text-[#8BEFF2]" />
                  <p className="text-[11px] font-semibold text-white">Mulai berkarya</p>
                </div>
              </div>

              <Button
                className="mt-6 h-12 w-full rounded-xl bg-[#19B5C6] text-sm font-bold text-white shadow-lg shadow-[#063F49]/40 transition-all hover:bg-[#12A4B4] hover:shadow-[#70E5EA]/20"
                onClick={() => navigate("/booking")}
                data-testid="button-book-now"
              >
                <Music className="mr-2 h-4 w-4" />
                Booking Sekarang
                <span className="ml-2 text-base">→</span>
              </Button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#AAC3C7]">
                <Clock className="h-3.5 w-3.5 text-[#8BEFF2]" />
                <span>Atur sesi musikmu dalam beberapa langkah</span>
              </div>
            </div>
          </Card>
        ) : (
          history.map((b, idx) => {
            const cfg = statusConfig[b.status] || statusConfig.pending;
            const jamEnd = b.jamMulai + b.durasi;
            return (
              <Card key={`${b.bookingId}-${idx}`} className="p-4 space-y-2" data-testid={`card-history-${b.bookingId}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm" data-testid={`text-band-${b.bookingId}`}>{b.namaBand}</span>
                      <Badge className={cfg.className} data-testid={`badge-status-${b.bookingId}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid={`text-layanan-${b.bookingId}`}>
                      {LAYANAN_MAP[b.jenisLayanan] || b.jenisLayanan}{b.withKeyboard ? " + Keyboard" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" data-testid={`text-total-${b.bookingId}`}>Rp {b.total.toLocaleString("id-ID")}</span>
                    <p className="text-[10px] text-muted-foreground font-mono" data-testid={`text-booking-id-${b.bookingId}`}>{b.bookingId}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1" data-testid={`text-tanggal-${b.bookingId}`}>
                    <Clock className="h-3 w-3" />
                    {formatTanggal(b.tanggal)}, {b.jamMulai.toString().padStart(2, "0")}:00 - {jamEnd.toString().padStart(2, "0")}:00 ({b.durasi} jam)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1" data-testid={`text-wa-${b.bookingId}`}>
                    <Phone className="h-3 w-3" />
                    {b.noWa}
                  </span>
                  <Badge
                    variant="secondary"
                    className={b.paymentMethod === "cash"
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25"
                      : "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25"
                    }
                    data-testid={`badge-payment-${b.bookingId}`}
                  >
                    {b.paymentMethod === "cash" ? (
                      <><Banknote className="mr-1 h-3 w-3" />Cash</>
                    ) : (
                      <><CreditCard className="mr-1 h-3 w-3" />Transfer</>
                    )}
                  </Badge>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={clearConfirm} onOpenChange={(open) => !open && setClearConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Riwayat</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah kamu yakin ingin menghapus semua riwayat booking? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Batalkan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleClearHistory}
              data-testid="button-confirm-clear"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
