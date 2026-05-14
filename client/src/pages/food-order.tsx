import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  ChevronRight,
  Coffee,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  Users,
  Banknote,
  CreditCard,
  X,
  Pencil,
} from "lucide-react";

const logoImage = "/images/logo.png";
const ADMIN_WA = "628991601137";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: "minuman" | "makanan";
  emoji: string;
};

const MENU: MenuItem[] = [
  { id: "air-mineral", name: "Air Mineral", price: 5000, category: "minuman", emoji: "💧" },
  { id: "es-teh-manis", name: "Es Teh Manis", price: 5000, category: "minuman", emoji: "🧋" },
  { id: "teh-hangat", name: "Teh Hangat", price: 5000, category: "minuman", emoji: "☕" },
  { id: "es-jeruk", name: "Es Jeruk", price: 7000, category: "minuman", emoji: "🍊" },
  { id: "kopi-hitam", name: "Kopi Hitam", price: 7000, category: "minuman", emoji: "☕" },
  { id: "kopi-susu", name: "Kopi Susu", price: 10000, category: "minuman", emoji: "🥛" },
  { id: "es-coklat", name: "Es Coklat", price: 10000, category: "minuman", emoji: "🍫" },
  { id: "es-capucino", name: "Es Capucino", price: 12000, category: "minuman", emoji: "☕" },
  { id: "mie-instan", name: "Mie Instan", price: 10000, category: "makanan", emoji: "🍜" },
  { id: "roti-bakar", name: "Roti Bakar", price: 15000, category: "makanan", emoji: "🍞" },
  { id: "gorengan", name: "Gorengan (3 pcs)", price: 6000, category: "makanan", emoji: "🥘" },
  { id: "keripik", name: "Keripik Singkong", price: 8000, category: "makanan", emoji: "🥔" },
];

type CartItem = { item: MenuItem; qty: number };
type Step = "band" | "menu" | "checkout" | "done";
type ServingTime = "sekarang" | "akhir_sesi";
type PaymentMethod = "cash" | "qris";

type TodayBooking = {
  namaBand: string;
  jamMulai: number;
  durasi: number;
  status: string;
};

function formatPrice(p: number) {
  return `Rp ${p.toLocaleString("id-ID")}`;
}

export default function FoodOrderPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("band");
  const [selectedBand, setSelectedBand] = useState<string>("");
  const [manualBand, setManualBand] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [servingTime, setServingTime] = useState<ServingTime>("sekarang");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [showCart, setShowCart] = useState(false);

  const { data: todayBookings = [], isLoading } = useQuery<TodayBooking[]>({
    queryKey: ["/api/bookings/today-confirmed"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/today-confirmed");
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json();
    },
  });

  const addToCart = useCallback((id: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 0;
      if (cur <= 1) next.delete(id);
      else next.set(id, cur - 1);
      return next;
    });
  }, []);

  const cartItems: CartItem[] = MENU.filter((m) => (cart.get(m.id) ?? 0) > 0).map((m) => ({
    item: m,
    qty: cart.get(m.id)!,
  }));

  const totalQty = cartItems.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cartItems.reduce((s, c) => s + c.item.price * c.qty, 0);

  const buildWaMessage = () => {
    const lines = [
      `👤 *${selectedBand}*`,
      `🛒 *Order:*`,
      ...cartItems.map((c) => `• ${c.item.emoji} ${c.item.name} x${c.qty} – ${formatPrice(c.item.price * c.qty)}`),
      ``,
      `💰 *Total: ${formatPrice(totalPrice)}*`,
      `💳 *Pembayaran:* ${paymentMethod === "cash" ? "Cash" : "QRIS"}`,
      `⏰ *Sajikan:* ${servingTime === "sekarang" ? "Sekarang" : "Saat sesi selesai"}`,
    ];
    return lines.join("\n");
  };

  const handleCheckout = () => {
    const msg = buildWaMessage();
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${ADMIN_WA}?text=${encoded}`, "_blank");
    setStep("done");
  };

  const minuman = MENU.filter((m) => m.category === "minuman");
  const makanan = MENU.filter((m) => m.category === "makanan");

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => (step === "menu" || step === "band" ? navigate("/") : setStep(step === "checkout" ? "menu" : "band"))}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={logoImage} alt="Joel Music Studio" className="h-7 w-7 rounded-md object-contain" />
            <span className="font-semibold text-sm">Order Makanan & Minuman</span>
          </div>
          {step === "menu" && (
            <button
              className="relative"
              onClick={() => setShowCart(true)}
            >
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              {totalQty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-teal-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalQty}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-4 pb-2">
          {(["band", "menu", "checkout"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-0 flex-1">
              <div className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                step === "done" || (["band","menu","checkout"] as Step[]).indexOf(step) > i
                  ? "bg-teal-500"
                  : step === s
                  ? "bg-teal-400"
                  : "bg-muted"
              }`} />
            </div>
          ))}
        </div>
      </nav>

      {/* ── STEP: BAND ── */}
      {step === "band" && (
        <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full">
          <div>
            <h2 className="font-bold text-lg">Sudah booking studio hari ini?</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pilih nama band kamu dari daftar di bawah, atau ketik nama band secara manual.
            </p>
          </div>

          {isLoading && (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 w-28 rounded-full bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && todayBookings.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Booking hari ini
              </p>
              <div className="flex flex-wrap gap-2">
                {todayBookings.map((b, i) => {
                  const jamEnd = b.jamMulai + b.durasi;
                  const isSelected = selectedBand === b.namaBand && !showManualInput;
                  return (
                    <button
                      key={i}
                      data-testid={`suggestion-band-${i}`}
                      onClick={() => {
                        setSelectedBand(b.namaBand);
                        setManualBand("");
                        setShowManualInput(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                        isSelected
                          ? "border-teal-500 bg-teal-500 text-white"
                          : "border-border bg-card hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{b.namaBand}</span>
                      <span className="text-[10px] opacity-70">
                        {b.jamMulai.toString().padStart(2,"0")}–{jamEnd.toString().padStart(2,"0")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && todayBookings.length === 0 && (
            <Card className="p-4 border-dashed">
              <p className="text-xs text-muted-foreground text-center">
                Belum ada booking hari ini yang terdaftar.
              </p>
            </Card>
          )}

          <div className="space-y-2">
            <button
              data-testid="toggle-manual-input"
              onClick={() => {
                setShowManualInput((v) => !v);
                if (!showManualInput) setSelectedBand("");
              }}
              className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium"
            >
              <Pencil className="h-3.5 w-3.5" />
              {showManualInput ? "Batal ketik manual" : "Nama band tidak ada di daftar? Ketik manual"}
            </button>

            {showManualInput && (
              <Input
                data-testid="input-manual-band"
                placeholder="Tulis nama band kamu..."
                value={manualBand}
                onChange={(e) => {
                  setManualBand(e.target.value);
                  setSelectedBand(e.target.value);
                }}
                className="rounded-xl"
                autoFocus
              />
            )}
          </div>

          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!selectedBand.trim()}
            onClick={() => setStep("menu")}
            data-testid="button-lanjut-menu"
          >
            Lanjut ke Menu
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── STEP: MENU ── */}
      {step === "menu" && (
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-teal-500/10 text-teal-700 border-teal-500/20">
              <Users className="h-3 w-3 mr-1" />
              {selectedBand}
            </Badge>
          </div>

          {/* Minuman */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="h-4 w-4 text-teal-600" />
              <h3 className="font-semibold text-sm">Minuman</h3>
            </div>
            <div className="space-y-2">
              {minuman.map((item) => {
                const qty = cart.get(item.id) ?? 0;
                return (
                  <Card key={item.id} className="flex items-center justify-between p-3 gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-xl">{item.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {qty > 0 ? (
                        <>
                          <button
                            className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                          <button
                            className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                            onClick={() => addToCart(item.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                          onClick={() => addToCart(item.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Makanan */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-4 w-4 text-teal-600" />
              <h3 className="font-semibold text-sm">Makanan</h3>
            </div>
            <div className="space-y-2">
              {makanan.map((item) => {
                const qty = cart.get(item.id) ?? 0;
                return (
                  <Card key={item.id} className="flex items-center justify-between p-3 gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-xl">{item.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {qty > 0 ? (
                        <>
                          <button
                            className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                          <button
                            className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                            onClick={() => addToCart(item.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                          onClick={() => addToCart(item.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ── STEP: CHECKOUT ── */}
      {step === "checkout" && (
        <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5">
          <h2 className="font-bold text-lg">Konfirmasi Order</h2>

          {/* Order summary */}
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan Order</p>
            {cartItems.map((c) => (
              <div key={c.item.id} className="flex items-center justify-between text-sm">
                <span>{c.item.emoji} {c.item.name} <span className="text-muted-foreground">x{c.qty}</span></span>
                <span className="font-medium">{formatPrice(c.item.price * c.qty)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="text-teal-600">{formatPrice(totalPrice)}</span>
            </div>
          </Card>

          {/* Serving time */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Kapan disajikan?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["sekarang", "akhir_sesi"] as ServingTime[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setServingTime(t)}
                  className={`rounded-xl border-2 p-3 text-sm transition-all duration-150 text-left ${
                    servingTime === t
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 font-semibold"
                      : "border-border bg-card hover:border-teal-300"
                  }`}
                >
                  <span className="block text-base mb-0.5">{t === "sekarang" ? "⚡" : "🕐"}</span>
                  {t === "sekarang" ? "Disajikan Sekarang" : "Saat Sesi Selesai"}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`rounded-xl border-2 p-3 transition-all duration-150 text-left ${
                  paymentMethod === "cash"
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                    : "border-border bg-card hover:border-teal-300"
                }`}
              >
                <Banknote className={`h-5 w-5 mb-1 ${paymentMethod === "cash" ? "text-teal-600" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium">Cash</p>
                <p className="text-xs text-muted-foreground">Bayar langsung</p>
              </button>
              <button
                onClick={() => setPaymentMethod("qris")}
                className={`rounded-xl border-2 p-3 transition-all duration-150 text-left ${
                  paymentMethod === "qris"
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                    : "border-border bg-card hover:border-teal-300"
                }`}
              >
                <CreditCard className={`h-5 w-5 mb-1 ${paymentMethod === "qris" ? "text-teal-600" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium">QRIS</p>
                <p className="text-xs text-muted-foreground">Scan barcode</p>
              </button>
            </div>
          </div>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleCheckout}
          >
            <span className="mr-1">✅</span>
            Kirim Order via WhatsApp
          </Button>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === "done" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-xl">Order Terkirim!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pesananmu sudah dikirim ke admin via WhatsApp. Tunggu konfirmasi ya!
            </p>
          </div>
          <Button variant="outline" onClick={() => { setStep("menu"); setCart(new Map()); }}>
            Order Lagi
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate("/")}>
            Kembali ke Beranda
          </Button>
        </div>
      )}

      {/* ── Fixed bottom bar (Menu step) ── */}
      {step === "menu" && totalQty > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-5 pointer-events-none">
          <Button
            className="w-full max-w-lg mx-auto flex pointer-events-auto bg-teal-600 hover:bg-teal-700 text-white shadow-xl"
            onClick={() => setStep("checkout")}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Lihat Keranjang ({totalQty} item) · {formatPrice(totalPrice)}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>
      )}

      {/* ── Cart drawer / sheet ── */}
      {showCart && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-background rounded-t-2xl shadow-xl p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Keranjang</h3>
              <button onClick={() => setShowCart(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            {cartItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Keranjang kosong</p>
            )}
            {cartItems.map((c) => (
              <div key={c.item.id} className="flex items-center justify-between gap-3">
                <span className="text-sm flex-1">{c.item.emoji} {c.item.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="h-6 w-6 rounded-full border flex items-center justify-center"
                    onClick={() => removeFromCart(c.item.id)}
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold">{c.qty}</span>
                  <button
                    className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center"
                    onClick={() => addToCart(c.item.id)}
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
                <span className="text-sm font-medium w-20 text-right">{formatPrice(c.item.price * c.qty)}</span>
              </div>
            ))}
            {cartItems.length > 0 && (
              <>
                <div className="border-t pt-2 flex items-center justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span className="text-teal-600">{formatPrice(totalPrice)}</span>
                </div>
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => { setShowCart(false); setStep("checkout"); }}
                >
                  Checkout
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
