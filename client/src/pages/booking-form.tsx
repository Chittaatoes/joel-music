import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { saveBookingToHistory } from "./history";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Clock,
  Users,
  Phone,
  Send,
  QrCode,
  MessageCircle,
  CheckCircle2,
  Loader2,
  Video,
  AlertTriangle,
  Upload,
  Banknote,
  X,
  Copy,
  Mic,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
const qrisImage = "/images/qris.png";
const logoImage = "/images/logo.png";

const ADMIN_WA = "628991601137";

function isIOSWebApp(): boolean {
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && isStandalone;
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

const LAYANAN_LABELS: Record<string, string> = {
  rehearsal: "Rehearsal / Latihan",
  karaoke: "Karaoke",
  live_recording: "Live Record",
  cover_lagu: "Cover Lagu / Minus One",
};

function isRamadan(): boolean {
  const now = new Date();
  const ramadanPeriods = [
    { start: new Date(2026, 1, 17), end: new Date(2026, 2, 19) },
    { start: new Date(2027, 1, 7), end: new Date(2027, 2, 9) },
    { start: new Date(2028, 0, 27), end: new Date(2028, 1, 26) },
  ];
  return ramadanPeriods.some((p) => now >= p.start && now <= p.end);
}

function calculatePrice(service: string, durasi: number, withKeyboard: boolean = false): number {
  const liveRecordPrice = isRamadan() ? 80000 : 100000;
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
      return durasi * liveRecordPrice;
    case "cover_lagu":
      return 500000;
    default:
      return durasi * 65000;
  }
}

const bookingFormSchema = z.object({
  namaBand: z.string().min(1, "Nama band wajib diisi"),
  jumlahPerson: z.string().min(1, "Jumlah person wajib diisi").refine((val) => parseInt(val) >= 1 && parseInt(val) <= 7, "Maksimal 7 person"),
  noWa: z.string().min(10, "Nomor WhatsApp minimal 10 digit").regex(/^[0-9+]+$/, "Format nomor tidak valid"),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingFormPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === "payment") {
      setTimeLeft(600);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  useEffect(() => {
    if (timeLeft === 0 && step === "payment") {
      toast({ title: "Waktu pembayaran habis", description: "Silakan ulangi proses booking", variant: "destructive" });
      navigate("/booking");
    }
  }, [timeLeft, step]);

  const params = new URLSearchParams(search);
  const tanggal = params.get("tanggal") || "";
  const jamMulai = parseInt(params.get("jam") || "0");
  const durasi = parseInt(params.get("durasi") || "1");
  const layananParam = params.get("layanan") || "rehearsal";
  const withKeyboard = params.get("keyboard") === "1" && layananParam === "rehearsal";

  const isCoverLagu = layananParam === "cover_lagu";
  const total = calculatePrice(layananParam, durasi, withKeyboard);
  const jamSelesai = jamMulai + durasi;
  const layananLabel = LAYANAN_LABELS[layananParam] || layananParam;

  const parsedDate = tanggal ? parse(tanggal, "yyyy-MM-dd", new Date()) : new Date();
  const formattedDate = format(parsedDate, "EEEE, dd MMMM yyyy", { locale: idLocale });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      namaBand: "",
      jumlahPerson: "4",
      noWa: "",
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async ({ formData, paymentMethod, buktiTransfer }: { formData: BookingFormValues; paymentMethod: string; buktiTransfer?: string }) => {
      const res = await apiRequest("POST", "/bookings", {
        namaBand: formData.namaBand,
        jumlahPerson: parseInt(formData.jumlahPerson),
        noWa: formData.noWa,
        jenisLayanan: layananParam,
        tanggal,
        jamMulai,
        durasi,
        paymentMethod,
        buktiTransfer,
        withKeyboard,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setBookingId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/bookings/schedule/" + tanggal] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal membuat booking",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormValues) => {
    setStep("payment");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Ukuran file maksimal 5MB", variant: "destructive" });
      return;
    }
    setBuktiFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setBuktiPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeBukti = () => {
    setBuktiFile(null);
    setBuktiPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* const handleConfirmTransfer = async () => {
    if (!buktiFile) {
      toast({ title: "Upload bukti transfer terlebih dahulu", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("bukti", buktiFile);
      const uploadRes = await fetch(`${API_BASE}/api/upload/bukti`, { method: "POST", body: formDataUpload });
      if (!uploadRes.ok) throw new Error("Gagal upload bukti transfer");
      const { url: buktiUrl } = await uploadRes.json();

      const values = form.getValues();
      createBookingMutation.mutate(
        { formData: values, paymentMethod: "transfer", buktiTransfer: buktiUrl },
        {
          onSuccess: () => {
            let details = `Nama Band: ${values.namaBand}\nLayanan: ${layananLabel}${withKeyboard ? " + Keyboard" : ""}\nJumlah Person: ${values.jumlahPerson} orang\nTanggal: ${formattedDate}\nJam: ${jamMulai.toString().padStart(2, "0")}:00`;
            if (!isCoverLagu) {
              details += ` - ${jamSelesai.toString().padStart(2, "0")}:00\nDurasi: ${durasi} jam`;
            }
            details += `\nTotal: Rp${total.toLocaleString("id-ID")}`;
            const message = `Halo Admin Joel Music Studio\n\nSaya ingin booking studio:\n\n${details}\n\nSaya sudah transfer via QRIS/BCA.\nBukti transfer sudah diupload di website.\nTerima kasih`;
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://wa.me/${ADMIN_WA}?text=${encodedMessage}`, "_blank");
            setStep("done");
          },
        }
      );
    } catch (error: any) {
      toast({ title: error.message || "Gagal upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }; */

  const handleConfirmTransfer = async () => {
  if (!buktiPreview) {
    toast({ title: "Upload bukti transfer terlebih dahulu", variant: "destructive" });
    return;
  }

  setUploading(true);

  try {
    const values = form.getValues();

    // 1️⃣ BUAT BOOKING DULU
    const bookingRes = await apiRequest("POST", "/bookings", {
      namaBand: values.namaBand,
      jumlahPerson: parseInt(values.jumlahPerson),
      noWa: values.noWa,
      jenisLayanan: layananParam,
      tanggal,
      jamMulai,
      durasi,
      paymentMethod: "transfer",
      buktiTransfer: buktiPreview, // langsung kirim base64
      withKeyboard,
    });

    const booking = await bookingRes.json();

    queryClient.invalidateQueries({ queryKey: ["/bookings/schedule/" + tanggal] });

    setBookingId(booking.id);
    setBookingCode(booking.bookingId || null);
    setStep("done");

    saveBookingToHistory({
      bookingId: booking.bookingId || booking.id,
      namaBand: values.namaBand,
      noWa: values.noWa,
      jenisLayanan: layananParam,
      tanggal,
      jamMulai,
      durasi,
      total,
      paymentMethod: "transfer",
      withKeyboard,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    if (booking.bookingId) {
      redirectToWhatsApp(booking.bookingId, "transfer");
    }

  } catch (error: any) {
    toast({ title: error.message || "Gagal membuat booking", variant: "destructive" });
  } finally {
    setUploading(false);
  }
};

  const handlePayCash = () => {
    const values = form.getValues();
    createBookingMutation.mutate(
      { formData: values, paymentMethod: "cash" },
      {
        onSuccess: (data) => {
          setBookingCode(data.bookingId || null);
          setStep("done");

          saveBookingToHistory({
            bookingId: data.bookingId || data.id,
            namaBand: values.namaBand,
            noWa: values.noWa,
            jenisLayanan: layananParam,
            tanggal,
            jamMulai,
            durasi,
            total,
            paymentMethod: "cash",
            withKeyboard,
            status: "pending",
            createdAt: new Date().toISOString(),
          });

          if (data.bookingId) {
            redirectToWhatsApp(data.bookingId, "cash");
          }
        },
      }
    );
  };

  const buildWhatsAppUrl = (bCode: string, paymentMethod: string): string => {
    const values = form.getValues();
    const jamStr = isCoverLagu
      ? `${jamMulai.toString().padStart(2, "0")}:00`
      : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`;

    let message = `\u{1F3B5} BOOKING STUDIO JOEL MUSIC\n\n`;
    message += `\u{1F4CC} Booking ID: ${bCode}\n`;
    message += `\u{1F5D3}\uFE0F Tanggal: ${formattedDate}\n`;
    message += `\u23F0 Jam: ${jamStr}\n`;
    message += `\u{1F3B8} Layanan: ${layananLabel}${withKeyboard ? " + Keyboard" : ""}\n\n`;
    message += `\u{1F464} Nama Band: ${values.namaBand}\n`;
    message += `\u{1F4DE} Nomor WhatsApp: ${values.noWa}\n\n`;
    message += `\u{1F4B0} PEMBAYARAN\n`;
    message += `Metode: ${paymentMethod === "cash" ? "Cash" : "Transfer/QRIS"}\n`;
    message += `Total: Rp ${total.toLocaleString("id-ID")}\n`;

    if (paymentMethod !== "cash") {
      message += `\nBukti Pembayaran:\nSudah diupload di website\n`;
    }

    const statusText = paymentMethod === "cash"
      ? "Bayar Nanti (Menunggu Konfirmasi Admin)"
      : "Sudah Bayar (Menunggu Konfirmasi Admin)";
    message += `\nStatus: ${statusText}\n\nTerima kasih \u{1F64F}`;

    const encoded = encodeURIComponent(message);
    return `https://wa.me/${ADMIN_WA}?text=${encoded}`;
  };

  const redirectToWhatsApp = (bCode: string, paymentMethod: string) => {
    const url = buildWhatsAppUrl(bCode, paymentMethod);
    setWaUrl(url);
    if (!isIOSWebApp()) {
      setTimeout(() => {
        window.open(url, "_blank");
      }, 100);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Nomor rekening disalin" });
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-done">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
              <span className="font-semibold text-sm">Booking Berhasil</span>
            </div>
          </div>
        </nav>
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold" data-testid="text-booking-success">Booking Terkirim!</h1>
          <p className="text-sm text-muted-foreground">
            Booking kamu sedang menunggu verifikasi admin. Kamu akan dihubungi via WhatsApp setelah pembayaran dikonfirmasi.
          </p>
          <Card className="p-4 text-left space-y-2">
            {bookingCode && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-bold text-primary" data-testid="text-booking-code">{bookingCode}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Layanan</span>
              <span className="font-medium">{layananLabel}{withKeyboard ? " + Keyboard" : ""}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nama Band</span>
              <span className="font-medium">{form.getValues().namaBand}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jam</span>
              <span className="font-medium">
                {isCoverLagu
                  ? `${jamMulai.toString().padStart(2, "0")}:00`
                  : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold">Rp {total.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25">Menunggu Verifikasi</Badge>
            </div>
          </Card>
          {waUrl && isIOSWebApp() && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Untuk pengguna iPhone WebApp, silakan klik tombol di bawah untuk membuka WhatsApp
              </p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => openWhatsAppIOS(waUrl)}
                data-testid="button-whatsapp-ios"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Buka WhatsApp
              </Button>
            </div>
          )}
          {waUrl && !isIOSWebApp() && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
              data-testid="link-whatsapp-confirm"
            >
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="button-whatsapp-confirm">
                <MessageCircle className="mr-2 h-4 w-4" />
                Kirim Konfirmasi via WhatsApp
              </Button>
            </a>
          )}
          <Button variant="outline" className="w-full" onClick={() => navigate("/")} data-testid="button-back-home">
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => setStep("form")} data-testid="button-back-payment">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
              <span className="font-semibold text-sm">Konfirmasi Pesanan</span>
            </div>
          </div>
        </nav>
        <div className="mx-auto max-w-md px-4 py-6 space-y-6">
          <Card className={`p-3 flex items-center justify-between gap-2 ${timeLeft <= 60 ? "border-red-500/50 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${timeLeft <= 60 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`} />
              <span className="text-sm font-medium">Batas waktu pembayaran</span>
            </div>
            <span className={`font-mono text-sm font-bold ${timeLeft <= 60 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`} data-testid="text-payment-timer">
              {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Layanan</span>
              <span className="font-medium">{layananLabel}{withKeyboard ? " + Keyboard" : ""}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nama Band</span>
              <span className="font-medium">{form.getValues().namaBand}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jam</span>
              <span className="font-medium">
                {isCoverLagu
                  ? `${jamMulai.toString().padStart(2, "0")}:00`
                  : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`}
              </span>
            </div>
            {!isCoverLagu && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Durasi</span>
                <span className="font-medium">{durasi} jam</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary" data-testid="text-payment-total">Rp {total.toLocaleString("id-ID")}</span>
            </div>
          </Card>

          <div className="space-y-1">
            <p className="text-sm font-medium">Metode Pembayaran:</p>
          </div>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">BCA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm" data-testid="text-bca-norek">8823018639</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard("8823018639")}
                data-testid="button-copy-norek"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">a.n. MUHAMMAD FAHREZA HAFIDZ</p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">QRIS - Joel Music Studio</span>
            </div>
            <div className="flex justify-center">
              <img
                src={qrisImage}
                alt="QRIS Joel Music Studio"
                className="max-w-[280px] w-full rounded-md"
                data-testid="img-qris"
              />
            </div>
          </Card>

          <Card className="p-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Pastikan kamu sudah membayar via transfer bank atau QRIS, lalu upload bukti transfer di bawah sebelum konfirmasi pesanan.
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Upload Bukti Transfer</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-bukti-transfer"
            />
            {buktiPreview ? (
              <div className="relative">
                <img
                  src={buktiPreview}
                  alt="Bukti transfer"
                  className="w-full max-h-[300px] object-contain rounded-md border"
                  data-testid="img-bukti-preview"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeBukti}
                  data-testid="button-remove-bukti"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/30 py-8 text-muted-foreground hover-elevate"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-bukti"
              >
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">Tap untuk pilih foto bukti transfer</span>
                <span className="text-xs">JPG, PNG, atau WebP (maks 5MB)</span>
              </button>
            )}
          </Card>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleConfirmTransfer}
              disabled={createBookingMutation.isPending || uploading || !buktiFile}
              data-testid="button-confirm-transfer"
            >
              {(createBookingMutation.isPending || uploading) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Mengupload..." : "Konfirmasi Pesanan"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePayCash}
              disabled={createBookingMutation.isPending}
              data-testid="button-pay-cash"
            >
              {createBookingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Bayar Cash
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/booking")}
              data-testid="button-cancel-booking"
            >
              Batal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/booking")} data-testid="button-back-form">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-semibold text-sm">Form Booking</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{layananLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" data-testid="badge-time">
              {isCoverLagu
                ? `Sesi: ${jamMulai.toString().padStart(2, "0")}:00`
                : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`}
            </Badge>
            {!isCoverLagu && <Badge variant="secondary" data-testid="badge-dur">{durasi} jam</Badge>}
            <span className="ml-auto text-lg font-bold" data-testid="text-form-total">Rp {total.toLocaleString("id-ID")}</span>
          </div>
        </Card>

        {isCoverLagu && (
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Maks 3 track vocal, 1x revisi balancing & frequency, include tuning vocal & mixing. Output: master lagu WAV + video.
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Video className="h-4 w-4" />
              Sudah termasuk video
            </p>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="namaBand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Band / Group</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Nirwana Project" {...field} data-testid="input-band-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jumlahPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah Person</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="7" placeholder="4" {...field} data-testid="input-person-count" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="noWa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor WhatsApp</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="08123456789" className="pl-9" {...field} data-testid="input-whatsapp" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createBookingMutation.isPending}
              data-testid="button-submit-booking"
            >
              {createBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Lanjutkan ke Pembayaran
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
