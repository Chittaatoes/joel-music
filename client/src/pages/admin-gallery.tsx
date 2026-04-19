import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getSupabaseClient } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Images,
  Plus,
  Trash2,
  Upload,
  X,
  ChevronDown,
  Music,
} from "lucide-react";
import type { GalleryItem, Service } from "@shared/schema";

function normalizeImageUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://joel-api.onrender.com${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function AdminGallery() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bandName, setBandName] = useState("");
  const [serviceType, setServiceType] = useState("rehearsal");
  const [quote, setQuote] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: galleryItems = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ["/api/admin/gallery"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gallery", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: bandSuggestions = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/gallery/confirmed-bands"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gallery/confirmed-bands", { credentials: "include" });
      if (!res.ok) return []; 
      return res.json();
    },
  });

  const { data: activeServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) return [];
      const all: Service[] = await res.json();
      return all.filter((s) => s.isActive);
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (activeServices.length > 0 && !activeServices.find((s) => s.key === serviceType)) {
      setServiceType(activeServices[0].key);
    }
  }, [activeServices]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file");

      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const ext = "jpg";
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`;
      const filePath = `gallery/${filename}`;

      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(filePath, compressed, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;

      const res = await fetch("/api/admin/gallery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          bandName: bandName.trim(),
          serviceType,
          quote: quote.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Gagal menyimpan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      toast({ title: "Berhasil!", description: "Foto galeri berhasil ditambahkan." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/gallery/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      toast({ title: "Dihapus", description: "Item galeri berhasil dihapus." });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Tidak bisa menghapus item.", variant: "destructive" });
    },
  });

  function resetForm() {
    setFile(null);
    setPreview(null);
    setBandName("");
    setServiceType("rehearsal");
    setQuote("");
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast({ title: "Upload foto", description: "Pilih foto terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!bandName.trim()) {
      toast({ title: "Nama band", description: "Nama band wajib diisi.", variant: "destructive" });
      return;
    }
    addMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" />
            Galeri Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola foto sesi band untuk ditampilkan di halaman utama
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm" data-testid="button-add-gallery">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Foto
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Tambah Foto Galeri</h2>
            <button
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground transition"
              data-testid="button-close-form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Foto Sesi <span className="text-destructive">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-gallery-image"
              />
              {preview ? (
                <div className="relative group w-full max-w-xs">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full rounded-lg object-cover aspect-video border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-8 text-muted-foreground hover:border-primary/40 hover:text-primary transition"
                  data-testid="button-upload-trigger"
                >
                  <Upload className="h-7 w-7" />
                  <span className="text-sm font-medium">Klik untuk upload foto</span>
                  <span className="text-xs">JPG, PNG, WebP · maks 5 MB</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Nama Band / Artis <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  onFocus={() => bandSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Masukkan nama band..."
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="input-band-name"
                  autoComplete="off"
                />
                {showSuggestions && bandSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    <p className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Booking terakhir dikonfirmasi
                    </p>
                    {bandSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setBandName(name);
                          setShowSuggestions(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                          bandName === name ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                        }`}
                        data-testid={`suggestion-band-${name}`}
                      >
                        <Music className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Tipe Layanan *</label>
              <div className="relative">
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none pr-10"
                  data-testid="select-service-type"
                >
                  {activeServices.map((svc) => (
                    <option key={svc.key} value={svc.key}>{svc.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Komentar / Testimoni <span className="text-muted-foreground">(opsional)</span></label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Ceritakan singkat atau testimoni dari sesi ini..."
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="textarea-quote"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={addMutation.isPending} data-testid="button-save-gallery">
                {addMutation.isPending ? "Menyimpan..." : "Simpan ke Galeri"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel-gallery">
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : galleryItems.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Belum ada foto galeri.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <img src={normalizeImageUrl(item.imageUrl)} alt={item.bandName} className="h-44 w-full object-cover" />
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{item.bandName}</p>
                    <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{activeServices.find((s) => s.key === item.serviceType)?.name ?? item.serviceType}</p>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`button-delete-gallery-${item.id}`}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Hapus
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
