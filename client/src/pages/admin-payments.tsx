import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Loader2,
  Music,
  Banknote,
  CreditCard,
  ImageIcon,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Booking } from "@shared/schema";

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function openWhatsAppIOS(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const LAYANAN_MAP: Record<string, string> = {
  rehearsal: "Rehearsal",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu",
};
function getLayananLabel(val: string) {
  return LAYANAN_MAP[val] || val;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25" },
  confirmed: { label: "Disetujui", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" },
  rejected: { label: "Ditolak", className: "bg-muted text-muted-foreground border-muted" },
};

export default function AdminPayments() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const openBukti = (base64: string) => {
  const newTab = window.open();
  if (newTab) {
    newTab.document.write(`
      <html>
        <head>
          <title>Bukti Transfer</title>
          <style>
            body {
              margin:0;
              display:flex;
              justify-content:center;
              align-items:center;
              background:#111;
            }
            img {
              max-width:100%;
              max-height:100vh;
            }
          </style>
        </head>
        <body>
          <img src="${base64}" />
        </body>
      </html>
    `);
  }
};

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/admin/bookings/all"],
    refetchInterval: 30000,
  });

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [iosWaUrl, setIosWaUrl] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingId(id);
      const res = await apiRequest("POST", `/admin/bookings/${id}/approve`);
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["/admin/bookings/all"] });
      const previous = queryClient.getQueryData<Booking[]>(["/admin/bookings/all"]);
      queryClient.setQueryData<Booking[]>(["/admin/bookings/all"], (old) =>
        old ? old.map((b) => b.id === id ? { ...b, status: "confirmed" } : b) : []
      );
      return { previous };
    },
    onSuccess: (data: { success: boolean; whatsappUrl: string }) => {
      toast({ title: "Booking disetujui & invoice dibuat" });
      setProcessingId(null);
      if (data.whatsappUrl) {
        if (isIOS()) {
          setIosWaUrl(data.whatsappUrl);
        } else {
          window.open(data.whatsappUrl, "_blank");
        }
      }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/admin/bookings/all"], context.previous);
      }
      toast({ title: "Gagal approve booking", description: error.message, variant: "destructive" });
      setProcessingId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/bookings/all"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingId(id);
      const res = await apiRequest("POST", `/admin/bookings/${id}/reject`);
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["/admin/bookings/all"] });
      const previous = queryClient.getQueryData<Booking[]>(["/admin/bookings/all"]);
      queryClient.setQueryData<Booking[]>(["/admin/bookings/all"], (old) =>
        old ? old.map((b) => b.id === id ? { ...b, status: "rejected" } : b) : []
      );
      return { previous };
    },
    onSuccess: (data: { success: boolean; whatsappUrl: string }) => {
      toast({ title: "Booking ditolak" });
      setProcessingId(null);
      if (data.whatsappUrl) {
        if (isIOS()) {
          setIosWaUrl(data.whatsappUrl);
        } else {
          window.open(data.whatsappUrl, "_blank");
        }
      }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/admin/bookings/all"], context.previous);
      }
      toast({ title: "Gagal reject booking", description: error.message, variant: "destructive" });
      setProcessingId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/bookings/all"] });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/admin/bookings/${id}`);
    },
    onMutate: async (id: string) => {
      setDeleteTarget(null);
      await queryClient.cancelQueries({ queryKey: ["/admin/bookings/all"] });
      const previous = queryClient.getQueryData<Booking[]>(["/admin/bookings/all"]);
      queryClient.setQueryData<Booking[]>(["/admin/bookings/all"], (old) =>
        old ? old.filter((b) => b.id !== id) : []
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Booking berhasil dihapus" });
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/admin/bookings/all"], context.previous);
      }
      toast({ title: "Gagal menghapus booking", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/bookings/all"] });
    },
  });

  const filteredBookings = statusFilter === "all"
    ? bookings
    : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-payments-title">Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Kelola verifikasi pembayaran booking</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="filter-tabs">
        {[
          { value: "all", label: "Semua" },
          { value: "pending", label: "Menunggu" },
          { value: "confirmed", label: "Disetujui" },
          { value: "rejected", label: "Ditolak" },
        ].map((tab) => {
          const count = tab.value === "all"
            ? bookings.length
            : bookings.filter((b) => b.status === tab.value).length;
          const isActive = statusFilter === tab.value;
          return (
            <Button
              key={tab.value}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => setStatusFilter(tab.value)}
              data-testid={`filter-tab-${tab.value}`}
            >
              {tab.label}
              <Badge
                variant="secondary"
                className="ml-1.5"
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {iosWaUrl && (
        <Card className="p-4 space-y-2 border-emerald-500/30 bg-emerald-500/5">
          <p className="text-sm text-muted-foreground">
            Silakan klik tombol di bawah untuk membuka WhatsApp
          </p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              openWhatsAppIOS(iosWaUrl);
              setIosWaUrl(null);
            }}
            data-testid="button-whatsapp-ios-admin"
          >
            <Phone className="mr-2 h-4 w-4" />
            Buka WhatsApp
          </Button>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Music className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Tidak ada booking untuk filter ini</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const cfg = statusConfig[b.status] || statusConfig.pending;
            const dateStr = format(new Date(b.tanggal + "T00:00:00"), "dd MMM yyyy", { locale: idLocale });
            return (
              <Card key={b.id} className="p-4 space-y-3" data-testid={`card-payment-${b.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{b.namaBand}</span>
                      <Badge className={cfg.className}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid={`text-layanan-${b.id}`}>
                      {getLayananLabel(b.jenisLayanan)}{b.withKeyboard ? " + Keyboard" : ""} | {b.jumlahPerson} Person
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" data-testid={`text-tanggal-${b.id}`}>
                        <Clock className="h-3 w-3" />
                        {dateStr}, {b.jamMulai.toString().padStart(2, "0")}:00 - {(b.jamMulai + b.durasi).toString().padStart(2, "0")}:00 ({b.durasi} jam)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" data-testid={`text-wa-${b.id}`}>
                        <Phone className="h-3 w-3" />
                        {b.noWa}
                      </span>
                      <Badge
                        variant="secondary"
                        className={b.paymentMethod === "cash"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25"
                          : "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25"
                        }
                        data-testid={`badge-payment-method-${b.id}`}
                      >
                        {b.paymentMethod === "cash" ? (
                          <><Banknote className="mr-1 h-3 w-3" />Cash</>
                        ) : (
                          <><CreditCard className="mr-1 h-3 w-3" />Transfer</>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-sm font-bold shrink-0">Rp {b.total.toLocaleString("id-ID")}</span>
                </div>

                {b.buktiTransfer && (
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Bukti Transfer</span>
                     <button
                        onClick={() => openBukti(b.buktiTransfer!)}
                        className="text-xs text-primary flex items-center gap-1"
                      >
                        Buka <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    <img
                      src={b.buktiTransfer}
                      alt="Bukti transfer"
                      className="max-h-[200px] rounded-md border object-contain"
                      data-testid={`img-bukti-${b.id}`}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  {b.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(b.id)}
                        disabled={processingId === b.id}
                        data-testid={`button-approve-${b.id}`}
                      >
                        {processingId === b.id && approveMutation.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        Approve & Kirim Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(b.id)}
                        disabled={processingId === b.id}
                        data-testid={`button-reject-${b.id}`}
                      >
                        {processingId === b.id && rejectMutation.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        Tolak
                      </Button>
                    </div>
                  ) : (
                    <div />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(b)}
                    data-testid={`button-delete-${b.id}`}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Hapus
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah kamu yakin ingin menghapus booking dari <span className="font-semibold">{deleteTarget?.namaBand}</span>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Batalkan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteTarget && deleteBookingMutation.mutate(deleteTarget.id)}
              disabled={deleteBookingMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteBookingMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
