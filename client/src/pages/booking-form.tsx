import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { usePageMeta } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Service, PricingTier, AdditionalEquipment, ExtraServiceItem } from "@shared/schema";
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
  ShieldCheck,
} from "lucide-react";
import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

function calcServicePrice(svc: Service | undefined, durasi: number, withKeyboard = false, equipmentIds: string[] = [], allEquipment: AdditionalEquipment[] = []): number {
  if (!svc) {
    if (durasi === 3) return 190000;
    return durasi * 65000;
  }
  if (svc.isFixedPrice && svc.fixedPrice != null) {
    return svc.fixedPrice;
  }
  const tiers = (svc.pricingTiers as PricingTier[] | null) || [];
  const tier = tiers.find((t) => t.hours === durasi);
  let base = tier ? tier.price : (svc.pricePerHour || 0) * durasi;
  if (withKeyboard && svc.key === "rehearsal") {
    base += durasi * 10000;
  }
  for (const eqId of equipmentIds) {
    const eq = allEquipment.find((e) => e.id === eqId);
    if (eq) base += eq.pricePerHour * durasi;
  }
  return base;
}

const bookingFormSchema = z.object({
  namaBand: z.string().min(1, "Nama band wajib diisi"),
  jumlahPerson: z.string().min(1, "Jumlah person wajib diisi").refine((val) => parseInt(val) >= 1 && parseInt(val) <= 7, "Maksimal 7 person"),
  noWa: z.string().min(10, "Nomor WhatsApp minimal 10 digit").regex(/^[0-9+]+$/, "Format nomor tidak valid"),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingFormPage() {
  usePageMeta({
    title: "Form Booking Studio - Joel Music Studio",
    description:
      "Isi form booking studio musik. Konfirmasi instan via WhatsApp setelah pembayaran QRIS.",
    path: "/booking/form",
  });
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const _params = new URLSearchParams(search);
  const equipmentParam = _params.get("equipment") || "";

  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [selectedMethod, setSelectedMethod] = useState<"transfer" | "cash">("transfer");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>(
    () => equipmentParam ? equipmentParam.split(",").filter(Boolean) : []
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const [multiServicesState, setMultiServicesState] = useState<ExtraServiceItem[]>(() => {
    if (_params.get("multi") !== "1") return [];
    try {
      const raw = sessionStorage.getItem("jms_multi_booking");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.services) || parsed.services.length < 2) return [];
      return parsed.services as ExtraServiceItem[];
    } catch { return []; }
  });
  const [multiGrandTotalState, setMultiGrandTotalState] = useState<number>(() => {
    if (_params.get("multi") !== "1") return 0;
    try {
      const raw = sessionStorage.getItem("jms_multi_booking");
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.services) || parsed.services.length < 2) return 0;
      return parsed.grandTotal as number;
    } catch { return 0; }
  });

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

  const tanggal = _params.get("tanggal") || "";
  const jamMulai = parseInt(_params.get("jam") || "0");
  const durasi = parseInt(_params.get("durasi") || "1");
  const layananParam = _params.get("layanan") || "rehearsal";
  const withKeyboard = _params.get("keyboard") === "1" && layananParam === "rehearsal";
  const isMultiMode = _params.get("multi") === "1";

  const multiServices = multiServicesState;
  const multiGrandTotal = multiGrandTotalState;

  const { data: serviceList = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  
  const { data: equipmentList = [] } = useQuery<AdditionalEquipment[]>({
    queryKey: ["/api/admin/equipment"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: appSettings } = useQuery<{ minimalDP: number }>({
    queryKey: ["/api/settings"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const minimalDP = appSettings?.minimalDP ?? 20000;
  const minimalDPFormatted = minimalDP.toLocaleString("id-ID");
  
  const currentService = serviceList.find((s) => s.key === layananParam);

  const isCoverLagu = currentService?.isFixedPrice ?? layananParam === "cover_lagu";
  const singleTotal = calcServicePrice(currentService, durasi, withKeyboard, selectedEquipmentIds, equipmentList);
  const total = isMultiMode && multiGrandTotal > 0 ? multiGrandTotal : singleTotal;
  const jamSelesai = jamMulai + durasi;
  const layananLabel = currentService?.name || layananParam;

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

  const onSubmit = (_data: BookingFormValues) => {
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

  const handleConfirmPayment = async () => {
    if (!buktiPreview) {
      const label = selectedMethod === "cash" ? "bukti DP" : "bukti transfer";
      toast({ title: `Upload ${label} terlebih dahulu`, variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      const values = form.getValues();

      const bookingRes = await apiRequest("POST", "/api/bookings", {
        namaBand: values.namaBand,
        jumlahPerson: parseInt(values.jumlahPerson),
        noWa: values.noWa,
        jenisLayanan: layananParam,
        tanggal,
        jamMulai,
        durasi,
        paymentMethod: selectedMethod,
        buktiTransfer: buktiPreview,
        withKeyboard,
        selectedEquipmentIds,
        ...(isMultiMode && multiServices.length > 1 ? { extraServices: multiServices } : {}),
      });

      const booking = await bookingRes.json();

      queryClient.invalidateQueries({ queryKey: ["/api/bookings/schedule/" + tanggal] });

      setBookingId(booking.id);
      setBookingCode(booking.bookingId || null);
      sessionStorage.removeItem("jms_multi_booking");
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
        paymentMethod: selectedMethod,
        withKeyboard,
        selectedEquipmentIds,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      if (booking.bookingId) {
        redirectToWhatsApp(booking.bookingId, selectedMethod);
      }
    } catch (error: any) {
      toast({ title: error.message || "Gagal membuat booking", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const buildWhatsAppUrl = (bCode: string, paymentMethod: string): string => {
    const values = form.getValues();
    const SEP = "━━━━━━━━━━━━━━━";

    let message = `\u{1F3B5} *BOOKING STUDIO JOEL MUSIC*\n\n`;
    message += `${SEP}\n\n`;
    message += `\u{1F4CC} *Booking ID*\n${bCode}\n\n`;
    message += `\u{1F5D3}\uFE0F *Tanggal*\n${formattedDate}\n\n`;

    if (isMultiMode && multiServices.length > 1) {
      message += `\u{1F3B8} *Layanan*\n`;
      for (const svc of multiServices) {
        const jamStr = `${svc.jamMulai.toString().padStart(2, "0")}:00 \u2013 ${(svc.jamMulai + svc.durasi).toString().padStart(2, "0")}:00`;
        const svcDateStr = svc.tanggal ? format(parse(svc.tanggal, "yyyy-MM-dd", new Date()), "dd MMM yyyy", { locale: idLocale }) : formattedDate;
        const svcAlatNames: string[] = [];
        if (svc.withKeyboard) svcAlatNames.push("Keyboard");
        for (const eqId of svc.selectedEquipmentIds || []) {
          const eq = equipmentList.find((e) => e.id === eqId);
          if (eq) svcAlatNames.push(eq.name);
        }
        message += `\u2022 ${svc.name} : ${svcDateStr}, ${jamStr} (${svc.durasi} jam)`;
        if (svcAlatNames.length > 0) message += ` [${svcAlatNames.join(", ")}]`;
        message += `\n`;
      }
      message += `\n${SEP}\n\n`;
      message += `\u{1F4CA} *Detail Harga*\n`;
      for (const svc of multiServices) {
        message += `\u2022 ${svc.name} : Rp ${svc.subtotal.toLocaleString("id-ID")}\n`;
      }
    } else {
      const jamStr = isCoverLagu
        ? `${jamMulai.toString().padStart(2, "0")}:00`
        : `${jamMulai.toString().padStart(2, "0")}:00 \u2013 ${jamSelesai.toString().padStart(2, "0")}:00`;
      const alatNames: string[] = [];
      if (withKeyboard) alatNames.push("Keyboard");
      for (const eqId of selectedEquipmentIds) {
        const eq = equipmentList.find((e) => e.id === eqId);
        if (eq) alatNames.push(eq.name);
      }
      message += `\u23F0 *Waktu*\n${jamStr}${!isCoverLagu ? ` (${durasi} jam)` : ""}\n\n`;
      message += `\u{1F3B8} *Layanan*\n${layananLabel}\n`;
      if (alatNames.length > 0) message += `\u{1F3B9} *Alat Tambahan*\n${alatNames.join(", ")}\n`;
      message += `\n${SEP}\n\n`;
      const tiers = (currentService?.pricingTiers as Array<{hours:number;price:number}> | null) || [];
      const tier = tiers.find((t) => t.hours === durasi);
      const serviceOnlyPrice = currentService?.isFixedPrice
        ? (currentService.fixedPrice || 0)
        : tier ? tier.price : (currentService?.pricePerHour || 65000) * durasi;
      message += `\u{1F4CA} *Detail Harga*\n`;
      message += `\u2022 ${layananLabel} : Rp ${serviceOnlyPrice.toLocaleString("id-ID")}\n`;
      if (withKeyboard) message += `\u2022 Keyboard : Rp ${(durasi * 10000).toLocaleString("id-ID")}\n`;
      for (const eqId of selectedEquipmentIds) {
        const eq = equipmentList.find((e) => e.id === eqId);
        if (eq) message += `\u2022 ${eq.name} : Rp ${(eq.pricePerHour * durasi).toLocaleString("id-ID")}\n`;
      }
    }

    message += `\n\u{1F4B0} *Total Pembayaran*\nRp ${total.toLocaleString("id-ID")}\n\n`;
    message += `${SEP}\n\n`;
    message += `\u{1F464} *Detail Pemesan*\n`;
    message += `\u2022 Nama Band : ${values.namaBand}\n`;
    message += `\u2022 WhatsApp : ${values.noWa}\n`;
    message += `\u2022 Jumlah Person : ${values.jumlahPerson} orang\n\n`;
    message += `${SEP}\n\n`;
    message += `\u{1F4B3} *Status Pembayaran*\n`;
    if (paymentMethod === "cash") {
      message += `Metode : Cash di Tempat (DP sudah dibayar)\n`;
      message += `DP : Min. Rp ${minimalDPFormatted} via QRIS/Transfer\n`;
      message += `Bukti DP : Sudah diupload di website\n`;
      message += `Sisa : Akan dibayar di tempat\n`;
    } else {
      message += `Metode : Transfer / QRIS (Lunas)\n`;
      message += `Bukti : Sudah diupload di website\n`;
    }
    message += `Status : \u23F3 Menunggu Konfirmasi Admin\n\n`;
    message += `${SEP}\n\n`;
    message += `\u{1F64F} Terima kasih telah booking di *Joel Music Studio*`;

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
              <span className="text-muted-foreground">Nama Band</span>
              <span className="font-medium">{form.getValues().namaBand}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {isMultiMode && multiServices.length > 1 ? (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layanan</span>
                {multiServices.map((svc, i) => {
                  const svcDateStr = svc.tanggal ? format(parse(svc.tanggal, "yyyy-MM-dd", new Date()), "dd MMM", { locale: idLocale }) : "";
                  const svcEqNames: string[] = [];
                  if (svc.withKeyboard) svcEqNames.push("Keyboard");
                  for (const id of svc.selectedEquipmentIds || []) {
                    const eq = equipmentList.find((e) => e.id === id);
                    if (eq) svcEqNames.push(eq.name);
                  }
                  return (
                  <div key={i} className="pl-2 space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{svc.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {svcDateStr && `${svcDateStr} · `}{svc.jamMulai.toString().padStart(2, "0")}:00–{(svc.jamMulai + svc.durasi).toString().padStart(2, "0")}:00
                        </span>
                      </div>
                      <span>Rp {svc.subtotal.toLocaleString("id-ID")}</span>
                    </div>
                    {svcEqNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {svcEqNames.map((name) => (
                          <span key={name} className="text-[10px] bg-primary/10 text-primary font-medium rounded-full px-2 py-0.5">+ {name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Layanan</span>
                  <span className="font-medium">{layananLabel}{withKeyboard ? " + Keyboard" : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jam</span>
                  <span className="font-medium">
                    {isCoverLagu
                      ? `${jamMulai.toString().padStart(2, "0")}:00`
                      : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`}
                  </span>
                </div>
                {selectedEquipmentIds.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alat Tambahan</span>
                    <span className="font-medium">
                      {selectedEquipmentIds.map((id) => equipmentList.find((e) => e.id === id)?.name).join(", ")}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
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
    const isCash = selectedMethod === "cash";
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

          {/* Timer */}
          <Card className={`p-3 flex items-center justify-between gap-2 ${timeLeft <= 60 ? "border-red-500/50 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${timeLeft <= 60 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`} />
              <span className="text-sm font-medium">Batas waktu pembayaran</span>
            </div>
            <span className={`font-mono text-sm font-bold ${timeLeft <= 60 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`} data-testid="text-payment-timer">
              {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          </Card>

          {/* Order summary */}
          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nama Band</span>
              <span className="font-medium">{form.getValues().namaBand}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-medium">{format(parsedDate, "dd/MM/yyyy")}</span>
            </div>
            {isMultiMode && multiServices.length > 1 ? (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layanan</span>
                {multiServices.map((svc, i) => {
                  const svcDateStr = svc.tanggal ? format(parse(svc.tanggal, "yyyy-MM-dd", new Date()), "dd MMM yyyy", { locale: idLocale }) : formattedDate;
                  const svcEqNames: string[] = [];
                  if (svc.withKeyboard) svcEqNames.push("Keyboard");
                  for (const id of svc.selectedEquipmentIds || []) {
                    const eq = equipmentList.find((e) => e.id === id);
                    if (eq) svcEqNames.push(eq.name);
                  }
                  return (
                  <div key={i} className="pl-2 space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{svc.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {svcDateStr} · {svc.jamMulai.toString().padStart(2, "0")}:00–{(svc.jamMulai + svc.durasi).toString().padStart(2, "0")}:00 · {svc.durasi} jam
                        </span>
                      </div>
                      <span className="font-medium">Rp {svc.subtotal.toLocaleString("id-ID")}</span>
                    </div>
                    {svcEqNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {svcEqNames.map((name) => (
                          <span key={name} className="text-[10px] bg-primary/10 text-primary font-medium rounded-full px-2 py-0.5">+ {name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Layanan</span>
                  <div className="text-right">
                    <span className="font-medium">{layananLabel}{withKeyboard ? " + Keyboard" : ""}</span>
                    <div className="text-xs text-muted-foreground">
                      {isCoverLagu
                        ? `${jamMulai.toString().padStart(2, "0")}:00`
                        : `${jamMulai.toString().padStart(2, "0")}:00 - ${jamSelesai.toString().padStart(2, "0")}:00`}
                    </div>
                  </div>
                </div>
                {!isCoverLagu && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Durasi</span>
                    <span className="font-medium">{durasi} jam</span>
                  </div>
                )}
                {selectedEquipmentIds.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alat Tambahan</span>
                    <span className="font-medium">
                      {selectedEquipmentIds.map((id) => equipmentList.find((e) => e.id === id)?.name).join(", ")}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary" data-testid="text-payment-total">Rp {total.toLocaleString("id-ID")}</span>
            </div>
          </Card>

          {/* Method selector */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Pilih Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedMethod("transfer"); removeBukti(); }}
                data-testid="button-method-transfer"
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  !isCash
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-muted-foreground/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className={`h-4 w-4 shrink-0 ${!isCash ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${!isCash ? "text-primary" : "text-foreground"}`}>Transfer / QRIS</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">Bayar lunas sekarang via QRIS atau transfer bank</p>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedMethod("cash"); removeBukti(); }}
                data-testid="button-method-cash"
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  isCash
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-muted-foreground/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className={`h-4 w-4 shrink-0 ${isCash ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${isCash ? "text-primary" : "text-foreground"}`}>Cash di Tempat</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">DP min. Rp {minimalDPFormatted} sekarang, sisa bayar di studio</p>
              </button>
            </div>
          </div>

          {/* DP info banner for cash */}
          {isCash && (
            <Card className="p-3 border-blue-500/30 bg-blue-500/5">
              <div className="flex gap-2">
                <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">DP Wajib Min. Rp {minimalDPFormatted}</p>
                  <p className="text-xs text-muted-foreground">
                    Bayar DP via QRIS atau transfer bank di bawah, lalu upload buktinya. Sisa pembayaran dibayar langsung di studio saat datang.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* BCA account */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Transfer Bank BCA</span>
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

          {/* QRIS */}
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

          {/* Warning */}
          <Card className="p-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {isCash
                  ? `Pastikan kamu sudah transfer DP minimal Rp ${minimalDPFormatted} via QRIS atau BCA, lalu upload buktinya di bawah untuk konfirmasi booking.`
                  : "Pastikan kamu sudah membayar lunas via transfer bank atau QRIS, lalu upload bukti di bawah sebelum konfirmasi pesanan."}
              </p>
            </div>
          </Card>

          {/* Upload bukti */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                {isCash ? "Upload Bukti DP" : "Upload Bukti Transfer"}
              </span>
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
                  alt="Bukti pembayaran"
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
                <span className="text-sm">
                  {isCash ? "Tap untuk upload foto bukti DP" : "Tap untuk pilih foto bukti transfer"}
                </span>
                <span className="text-xs">JPG, PNG, atau WebP (maks 5MB)</span>
              </button>
            )}
          </Card>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleConfirmPayment}
              disabled={uploading || !buktiPreview}
              data-testid="button-confirm-payment"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Memproses..." : isCash ? "Konfirmasi Booking (DP Dibayar)" : "Konfirmasi Pesanan"}
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
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          {isMultiMode && multiServices.length > 1 ? (
            <div className="space-y-1.5 pt-1">
              {multiServices.map((svc, i) => {
                const svcDateStr = svc.tanggal ? format(parse(svc.tanggal, "yyyy-MM-dd", new Date()), "dd MMM", { locale: idLocale }) : "";
                const svcEqNames: string[] = [];
                if (svc.withKeyboard) svcEqNames.push("Keyboard");
                for (const id of svc.selectedEquipmentIds || []) {
                  const eq = equipmentList.find((e) => e.id === id);
                  if (eq) svcEqNames.push(eq.name);
                }
                return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold">{i + 1}</span>
                      </div>
                      <span className="font-medium truncate">{svc.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {svcDateStr && `${svcDateStr} · `}{svc.jamMulai.toString().padStart(2, "0")}:00–{(svc.jamMulai + svc.durasi).toString().padStart(2, "0")}:00
                      </span>
                    </div>
                    <span className="font-medium shrink-0">Rp {svc.subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  {svcEqNames.length > 0 && (
                    <div className="pl-6 flex flex-wrap gap-1">
                      {svcEqNames.map((name) => (
                        <span key={name} className="text-[10px] bg-primary/10 text-primary font-medium rounded-full px-2 py-0.5">+ {name}</span>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-bold" data-testid="text-form-total">Rp {total.toLocaleString("id-ID")}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{layananLabel}</span>
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
            </>
          )}
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
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="1"
                      max="7"
                      placeholder="4"
                      data-testid="input-person-count"
                      {...field}
                      onKeyDown={(e) => {
                        const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
                        if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        if (raw === "") { field.onChange(""); return; }
                        const num = Math.min(7, Math.max(1, parseInt(raw)));
                        field.onChange(String(num));
                      }}
                    />
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
                      <Input
                        placeholder="08123456789"
                        className="pl-9"
                        type="tel"
                        inputMode="numeric"
                        data-testid="input-whatsapp"
                        {...field}
                        onKeyDown={(e) => {
                          const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
                          const isPlus = e.key === "+" && (e.currentTarget.selectionStart ?? 0) === 0;
                          if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key) && !isPlus && !e.metaKey && !e.ctrlKey) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const filtered = raw.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "");
                          field.onChange(filtered);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terms & Conditions */}
            <div className="space-y-3 pt-1">
              <div className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Hal Penting yang Perlu Diketahui</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTermsModalOpen(true)}
                    className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline underline-offset-2 transition-colors whitespace-nowrap"
                    data-testid="button-open-terms"
                  >
                    Lihat detail
                  </button>
                </div>
                <ul className="space-y-2">
                  {[
                    "DP hangus jika tidak hadir atau membatalkan tanpa pemberitahuan",
                    "Reschedule hanya 1×, maksimal 1 jam sebelum jadwal",
                    "Keterlambatan tidak menambah durasi sesi",
                    "Kerusakan fasilitas menjadi tanggung jawab pengguna",
                  ].map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300/90">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-terms">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="peer sr-only"
                    data-testid="checkbox-terms"
                  />
                  <div className="h-5 w-5 rounded border-2 border-input bg-background flex items-center justify-center transition-colors peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary/60">
                    {termsAccepted && (
                      <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground leading-snug select-none">
                  Saya menyetujui{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }}
                    className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors"
                    data-testid="button-terms-link"
                  >
                    Syarat &amp; Ketentuan
                  </button>{" "}
                  Joel Music Studio
                </span>
              </label>
            </div>

            {/* Terms Modal */}
            {termsModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                data-testid="modal-terms"
              >
                <div
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setTermsModalOpen(false)}
                />
                <div className="relative z-10 w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-base">Syarat &amp; Ketentuan</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTermsModalOpen(false)}
                      className="rounded-full p-1.5 hover:bg-muted transition-colors"
                      data-testid="button-close-terms"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs text-muted-foreground/60 italic">Joel Music Studio — Terakhir diperbarui: {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</p>

                    {[
                      {
                        title: "Ketentuan Booking",
                        items: [
                          "Booking dilakukan melalui website resmi Joel Music Studio.",
                          <>Jadwal dianggap <strong className="text-foreground">valid</strong> setelah pengguna melakukan pembayaran Down Payment (DP).</>,
                          "Tanpa DP, slot waktu dapat diberikan kepada pengguna lain.",
                        ],
                      },
                      {
                        title: "Pembayaran (DP)",
                        items: [
                          "DP berfungsi sebagai tanda jadi dan pengunci jadwal studio.",
                          "Besaran DP diinformasikan saat proses booking.",
                          "Sisa pembayaran dapat dilakukan sebelum atau saat sesi dimulai.",
                        ],
                      },
                      {
                        title: "Pembatalan & No-Show",
                        items: [
                          <>Tidak hadir tanpa pemberitahuan → <strong className="text-foreground">DP hangus</strong>.</>,
                          <>Membatalkan sepihak tanpa alasan jelas → <strong className="text-foreground">DP tetap hangus</strong>.</>,
                        ],
                      },
                      {
                        title: "Reschedule",
                        items: [
                          <>Reschedule diizinkan maksimal <strong className="text-foreground">1 (satu) kali</strong>.</>,
                          <>Harus diajukan maksimal <strong className="text-foreground">1 jam sebelum</strong> jadwal booking.</>,
                          "Hanya bisa dilakukan jika slot baru tersedia.",
                          "Setelah reschedule, tidak dapat ubah jadwal lagi.",
                          <>Jika tetap tidak hadir setelah reschedule → <strong className="text-foreground">DP hangus</strong>.</>,
                        ],
                      },
                      {
                        title: "Keterlambatan",
                        items: [
                          <>Keterlambatan pengguna <strong className="text-foreground">tidak menambah durasi sesi</strong>.</>,
                          "Waktu booking tetap mengikuti jadwal awal yang dipilih.",
                        ],
                      },
                      {
                        title: "Tanggung Jawab Pengguna",
                        items: [
                          "Pengguna wajib menjaga fasilitas studio dengan baik.",
                          "Kerusakan akibat kelalaian pengguna menjadi tanggung jawab pengguna.",
                        ],
                      },
                      {
                        title: "Perubahan dari Pihak Studio",
                        items: [
                          "Studio berhak mengubah jadwal dalam kondisi force majeure / kendala teknis.",
                          "Studio akan memberikan alternatif jadwal atau mengembalikan DP jika kesalahan berasal dari pihak studio.",
                        ],
                      },
                    ].map((section) => (
                      <div key={section.title}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">{section.title}</p>
                        <ul className="space-y-1.5">
                          {section.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <div className="border-t pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Kontak</p>
                      <p>Joel Music Studio</p>
                      <p>WhatsApp: 0899-1601-137</p>
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t shrink-0">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => { setTermsAccepted(true); setTermsModalOpen(false); }}
                      data-testid="button-accept-terms"
                    >
                      Saya Setuju
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!termsAccepted}
              data-testid="button-submit-booking"
            >
              <Send className="mr-2 h-4 w-4" />
              Lanjutkan ke Pembayaran
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
