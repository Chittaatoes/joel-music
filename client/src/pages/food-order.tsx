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
  Copy,
} from "lucide-react";
import type { FoodMenuItem, MenuOptionGroup } from "@shared/schema";

const logoImage = "/images/logo.png";
const qrisImage = "/images/qris.png";
const ADMIN_WA = "628991601137";
const FOOD_ORDER_LS_KEY = "jms_food_order_history";

type CartEntry = {
  cartKey: string;
  item: FoodMenuItem;
  qty: number;
  selectedOptions: Record<string, string>;
  effectivePrice: number;
};

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

function makeCartKey(itemId: string, opts: Record<string, string>) {
  const sorted = Object.keys(opts).sort().map((k) => `${k}=${opts[k]}`).join("&");
  return sorted ? `${itemId}::${sorted}` : itemId;
}

function calcEffectivePrice(item: FoodMenuItem, opts: Record<string, string>): number {
  const options = (item.options as MenuOptionGroup[]) || [];
  let extra = 0;
  for (const opt of options) {
    if (opt.type === "toggle" && opts[opt.key] === "true" && opt.priceAdd) {
      extra += opt.priceAdd;
    }
  }
  return item.price + extra;
}

function optionLabel(opts: Record<string, string>, options: MenuOptionGroup[]): string {
  const parts: string[] = [];
  for (const opt of options) {
    const val = opts[opt.key];
    if (!val || val === "false") continue;
    if (opt.type === "select") parts.push(val);
    if (opt.type === "toggle" && val === "true") parts.push(opt.label);
  }
  return parts.join(", ");
}

function defaultOptions(options: MenuOptionGroup[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const opt of options) {
    if (opt.type === "select" && opt.choices && opt.choices.length > 0) {
      result[opt.key] = opt.choices[0];
    } else if (opt.type === "toggle") {
      result[opt.key] = "false";
    }
  }
  return result;
}

function saveFoodOrderToHistory(order: {
  id: string;
  namaBand: string;
  items: { id: string; name: string; price: number; qty: number; emoji: string; selectedOptions?: Record<string, string> }[];
  total: number;
  servingTime: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}) {
  try {
    const raw = localStorage.getItem(FOOD_ORDER_LS_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(order);
    localStorage.setItem(FOOD_ORDER_LS_KEY, JSON.stringify(history));
  } catch {}
}

export default function FoodOrderPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("band");
  const [selectedBand, setSelectedBand] = useState<string>("");
  const [manualBand, setManualBand] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [servingTime, setServingTime] = useState<ServingTime>("sekarang");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [showCart, setShowCart] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [optionDialogItem, setOptionDialogItem] = useState<FoodMenuItem | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});

  const { data: todayBookings = [], isLoading } = useQuery<TodayBooking[]>({
    queryKey: ["/bookings/today-bands"],
    queryFn: async () => {
      const res = await fetch("/bookings/today-bands");
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json();
    },
  });

  const { data: menuItems = [], isLoading: isMenuLoading } = useQuery<FoodMenuItem[]>({
    queryKey: ["/api/food-menu"],
    queryFn: async () => {
      const res = await fetch("/api/food-menu");
      if (!res.ok) throw new Error("Gagal memuat menu");
      return res.json();
    },
  });

  const cartEntries = Array.from(cart.values());
  const totalQty = cartEntries.reduce((s, e) => s + e.qty, 0);
  const totalPrice = cartEntries.reduce((s, e) => s + e.effectivePrice * e.qty, 0);

  const addCartEntry = useCallback((entry: CartEntry) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(entry.cartKey);
      if (existing) {
        next.set(entry.cartKey, { ...existing, qty: existing.qty + 1 });
      } else {
        next.set(entry.cartKey, { ...entry, qty: 1 });
      }
      return next;
    });
  }, []);

  const removeCartEntry = useCallback((cartKey: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(cartKey);
      if (!existing) return prev;
      if (existing.qty <= 1) {
        next.delete(cartKey);
      } else {
        next.set(cartKey, { ...existing, qty: existing.qty - 1 });
      }
      return next;
    });
  }, []);

  const handleAddItem = useCallback((item: FoodMenuItem) => {
    const options = (item.options as MenuOptionGroup[]) || [];
    if (options.length === 0) {
      addCartEntry({
        cartKey: item.id,
        item,
        qty: 1,
        selectedOptions: {},
        effectivePrice: item.price,
      });
      return;
    }
    setOptionSelections(defaultOptions(options));
    setOptionDialogItem(item);
  }, [addCartEntry]);

  const handleOptionConfirm = () => {
    if (!optionDialogItem) return;
    const effectivePrice = calcEffectivePrice(optionDialogItem, optionSelections);
    const cartKey = makeCartKey(optionDialogItem.id, optionSelections);
    addCartEntry({ cartKey, item: optionDialogItem, qty: 1, selectedOptions: { ...optionSelections }, effectivePrice });
    setOptionDialogItem(null);
  };

  const buildWaMessage = () => {
    const lines = [
      `👤 *${selectedBand}*`,
      `🛒 *Order:*`,
      ...cartEntries.map((e) => {
        const opts = optionLabel(e.selectedOptions, (e.item.options as MenuOptionGroup[]) || []);
        const label = opts ? `${e.item.name} (${opts})` : e.item.name;
        return `• ${e.item.emoji} ${label} x${e.qty} – ${formatPrice(e.effectivePrice * e.qty)}`;
      }),
      ``,
      `💰 *Total: ${formatPrice(totalPrice)}*`,
      `💳 *Pembayaran:* ${paymentMethod === "cash" ? "Cash" : "QRIS"}`,
      `⏰ *Sajikan:* ${servingTime === "sekarang" ? "Sekarang" : "Saat sesi selesai"}`,
    ];
    return lines.join("\n");
  };

  const handleCheckout = async () => {
    setIsSubmitting(true);
    const itemsPayload = cartEntries.map((e) => ({
      id: e.item.id,
      name: e.item.name,
      price: e.effectivePrice,
      qty: e.qty,
      emoji: e.item.emoji,
      selectedOptions: Object.keys(e.selectedOptions).length > 0 ? e.selectedOptions : undefined,
    }));

    try {
      const res = await fetch("/api/food-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaBand: selectedBand,
          items: itemsPayload,
          total: totalPrice,
          servingTime,
          paymentMethod,
        }),
      });
      if (res.ok) {
        const order = await res.json();
        saveFoodOrderToHistory({
          id: order.id,
          namaBand: selectedBand,
          items: itemsPayload,
          total: totalPrice,
          servingTime,
          paymentMethod,
          status: "pending",
          createdAt: order.createdAt || new Date().toISOString(),
        });
      }
    } catch {}

    const msg = buildWaMessage();
    window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`, "_blank");
    setIsSubmitting(false);
    setStep("done");
  };

  const handleCopyNorek = () => {
    navigator.clipboard.writeText("8823018639").then(() => {
      setCopied(true);
      toast({ title: "Nomor rekening disalin" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const minuman = menuItems.filter((m) => m.category === "minuman");
  const makanan = menuItems.filter((m) => m.category === "makanan");

  function getCartQtyForItem(itemId: string): number {
    let total = 0;
    for (const e of cart.values()) {
      if (e.item.id === itemId) total += e.qty;
    }
    return total;
  }

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
            <button className="relative" onClick={() => setShowCart(true)}>
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
              {[1, 2, 3].map((i) => <div key={i} className="h-9 w-28 rounded-full bg-muted animate-pulse" />)}
            </div>
          )}

          {!isLoading && todayBookings.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking hari ini</p>
              <div className="flex flex-wrap gap-2">
                {todayBookings.map((b, i) => {
                  const jamEnd = b.jamMulai + b.durasi;
                  const isSelected = selectedBand === b.namaBand && !showManualInput;
                  return (
                    <button
                      key={i}
                      data-testid={`suggestion-band-${i}`}
                      onClick={() => { setSelectedBand(b.namaBand); setManualBand(""); setShowManualInput(false); }}
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
              <p className="text-xs text-muted-foreground text-center">Belum ada booking hari ini yang terdaftar.</p>
            </Card>
          )}

          <div className="space-y-2">
            <button
              data-testid="toggle-manual-input"
              onClick={() => { setShowManualInput((v) => !v); if (!showManualInput) setSelectedBand(""); }}
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
                onChange={(e) => { setManualBand(e.target.value); setSelectedBand(e.target.value); }}
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

          {isMenuLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          )}

          {/* Minuman */}
          {minuman.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Coffee className="h-4 w-4 text-teal-600" />
                <h3 className="font-semibold text-sm">Minuman</h3>
              </div>
              <div className="space-y-2">
                {minuman.map((item) => {
                  const totalQtyForItem = getCartQtyForItem(item.id);
                  const options = (item.options as MenuOptionGroup[]) || [];
                  const hasOptions = options.length > 0;
                  return (
                    <Card key={item.id} className="flex items-center justify-between p-3 gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="text-xl">{item.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(item.price)}
                            {hasOptions && <span className="ml-1 text-teal-600 dark:text-teal-400">· ada pilihan</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {totalQtyForItem > 0 && (
                          <span className="text-xs font-semibold text-teal-600 w-4 text-center">{totalQtyForItem}</span>
                        )}
                        <button
                          className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                          onClick={() => handleAddItem(item)}
                          data-testid={`button-add-${item.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Makanan */}
          {makanan.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <UtensilsCrossed className="h-4 w-4 text-teal-600" />
                <h3 className="font-semibold text-sm">Makanan</h3>
              </div>
              <div className="space-y-2">
                {makanan.map((item) => {
                  const totalQtyForItem = getCartQtyForItem(item.id);
                  const options = (item.options as MenuOptionGroup[]) || [];
                  const hasOptions = options.length > 0;
                  return (
                    <Card key={item.id} className="flex items-center justify-between p-3 gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="text-xl">{item.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(item.price)}
                            {hasOptions && <span className="ml-1 text-teal-600 dark:text-teal-400">· ada pilihan</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {totalQtyForItem > 0 && (
                          <span className="text-xs font-semibold text-teal-600 w-4 text-center">{totalQtyForItem}</span>
                        )}
                        <button
                          className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors"
                          onClick={() => handleAddItem(item)}
                          data-testid={`button-add-${item.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {!isMenuLoading && menuItems.length === 0 && (
            <Card className="p-8 text-center border-dashed">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Menu belum tersedia</p>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP: CHECKOUT ── */}
      {step === "checkout" && (
        <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5">
          <h2 className="font-bold text-lg">Konfirmasi Order</h2>

          {/* Order summary */}
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan Order</p>
            {cartEntries.map((e) => {
              const opts = optionLabel(e.selectedOptions, (e.item.options as MenuOptionGroup[]) || []);
              return (
                <div key={e.cartKey} className="flex items-start justify-between text-sm gap-2">
                  <span className="flex-1">
                    {e.item.emoji} {e.item.name}
                    {opts && <span className="text-muted-foreground text-xs ml-1">({opts})</span>}
                    <span className="text-muted-foreground ml-1">x{e.qty}</span>
                  </span>
                  <span className="font-medium shrink-0">{formatPrice(e.effectivePrice * e.qty)}</span>
                </div>
              );
            })}
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

          {paymentMethod === "qris" && (
            <Card className="p-4 space-y-4 border-teal-500/30 bg-teal-500/5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cara Pembayaran QRIS</p>
              <div className="flex flex-col items-center gap-3">
                <img src={qrisImage} alt="QRIS Joel Music Studio" className="w-52 h-52 object-contain rounded-xl border bg-white p-2" />
                <p className="text-xs text-muted-foreground text-center">Scan kode QRIS di atas dengan aplikasi bank / e-wallet kamu</p>
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atau Transfer Bank</p>
                <div className="flex items-center justify-between rounded-lg bg-background border px-3 py-2.5">
                  <div>
                    <p className="text-xs text-muted-foreground">Transfer Bank BCA</p>
                    <p className="font-mono font-semibold text-base tracking-wider">8823018639</p>
                    <p className="text-xs text-muted-foreground">a.n. Muhammad Fahreza Hafidz</p>
                  </div>
                  <button
                    onClick={handleCopyNorek}
                    className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium shrink-0 ml-3"
                    data-testid="button-copy-norek-food"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Tersalin!" : "Salin"}
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleCheckout}
            disabled={isSubmitting}
            data-testid="button-kirim-order"
          >
            {isSubmitting ? <span className="animate-pulse">Memproses...</span> : <><span className="mr-1">✅</span>Kirim Order via WhatsApp</>}
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
            <p className="text-sm text-muted-foreground mt-1">Pesananmu sudah dikirim ke admin via WhatsApp. Tunggu konfirmasi ya!</p>
          </div>
          <Button variant="outline" onClick={() => { setStep("menu"); setCart(new Map()); }}>Order Lagi</Button>
          <Button variant="outline" onClick={() => navigate("/history")}>
            <Clock className="mr-2 h-4 w-4" />
            Lihat Riwayat Pesanan
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate("/")}>Kembali ke Beranda</Button>
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

      {/* ── Cart drawer ── */}
      {showCart && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-background rounded-t-2xl shadow-xl p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Keranjang</h3>
              <button onClick={() => setShowCart(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {cartEntries.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Keranjang kosong</p>
            )}
            {cartEntries.map((e) => {
              const opts = optionLabel(e.selectedOptions, (e.item.options as MenuOptionGroup[]) || []);
              return (
                <div key={e.cartKey} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{e.item.emoji} {e.item.name}</span>
                    {opts && <span className="text-xs text-muted-foreground ml-1">({opts})</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="h-6 w-6 rounded-full border flex items-center justify-center" onClick={() => removeCartEntry(e.cartKey)}>
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="w-4 text-center text-sm font-semibold">{e.qty}</span>
                    <button className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center" onClick={() => handleAddItem(e.item)}>
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{formatPrice(e.effectivePrice * e.qty)}</span>
                </div>
              );
            })}
            {cartEntries.length > 0 && (
              <>
                <div className="border-t pt-2 flex items-center justify-between font-semibold">
                  <span className="text-sm">Total</span>
                  <span className="text-sm text-teal-600">{formatPrice(totalPrice)}</span>
                </div>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setShowCart(false); setStep("checkout"); }}>
                  Lanjut Checkout <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Option picker dialog ── */}
      {optionDialogItem && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOptionDialogItem(null)} />
          <div className="relative bg-background rounded-t-2xl shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{optionDialogItem.emoji} {optionDialogItem.name}</h3>
                <p className="text-xs text-muted-foreground">Pilih opsi sebelum menambahkan ke keranjang</p>
              </div>
              <button onClick={() => setOptionDialogItem(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            {((optionDialogItem.options as MenuOptionGroup[]) || []).map((opt) => (
              <div key={opt.key} className="space-y-2">
                <p className="text-sm font-semibold">{opt.label}</p>
                {opt.type === "select" && opt.choices && (
                  <div className="flex flex-wrap gap-2">
                    {opt.choices.map((choice) => (
                      <button
                        key={choice}
                        onClick={() => setOptionSelections((prev) => ({ ...prev, [opt.key]: choice }))}
                        className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                          optionSelections[opt.key] === choice
                            ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300"
                            : "border-border bg-card hover:border-teal-300"
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
                {opt.type === "toggle" && (
                  <button
                    onClick={() => setOptionSelections((prev) => ({ ...prev, [opt.key]: prev[opt.key] === "true" ? "false" : "true" }))}
                    className={`flex items-center gap-3 w-full rounded-xl border-2 p-3 text-sm font-medium transition-all text-left ${
                      optionSelections[opt.key] === "true"
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                        : "border-border bg-card hover:border-teal-300"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      optionSelections[opt.key] === "true" ? "border-teal-500 bg-teal-500" : "border-muted-foreground"
                    }`}>
                      {optionSelections[opt.key] === "true" && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span>{opt.label}</span>
                    {opt.priceAdd && (
                      <span className="ml-auto text-xs text-teal-600 dark:text-teal-400 shrink-0">
                        +{formatPrice(opt.priceAdd)}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}

            <div className="border-t pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Harga</p>
                <p className="font-bold text-teal-600 text-lg">
                  {formatPrice(calcEffectivePrice(optionDialogItem, optionSelections))}
                </p>
              </div>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleOptionConfirm}
                data-testid="button-confirm-option"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah ke Keranjang
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
