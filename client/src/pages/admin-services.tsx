import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Music,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Service, PricingTier, AdditionalEquipment, OperationalSchedule } from "@shared/schema";

type ServiceForm = {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  isFixedPrice: boolean;
  fixedPrice: string;
  pricePerHour: string;
  pricingTiers: { hours: string; price: string }[];
  note: string;
  sortOrder: string;
};

type EquipmentForm = {
  name: string;
  pricePerHour: string;
  serviceKeys: string[];
  isActive: boolean;
  sortOrder: string;
};

function emptyForm(): ServiceForm {
  return {
    key: "",
    name: "",
    description: "",
    isActive: true,
    isFixedPrice: false,
    fixedPrice: "",
    pricePerHour: "",
    pricingTiers: [],
    note: "",
    sortOrder: "0",
  };
}

function serviceToForm(svc: Service): ServiceForm {
  const tiers = (svc.pricingTiers as PricingTier[] | null) || [];
  return {
    key: svc.key,
    name: svc.name,
    description: svc.description || "",
    isActive: svc.isActive,
    isFixedPrice: svc.isFixedPrice,
    fixedPrice: svc.fixedPrice != null ? String(svc.fixedPrice) : "",
    pricePerHour: svc.pricePerHour != null ? String(svc.pricePerHour) : "",
    pricingTiers: tiers.map((t) => ({ hours: String(t.hours), price: String(t.price) })),
    note: svc.note || "",
    sortOrder: String(svc.sortOrder),
  };
}

function formToPayload(form: ServiceForm) {
  const tiers = form.pricingTiers
    .filter((t) => t.hours !== "" && t.price !== "")
    .map((t) => ({ hours: parseInt(t.hours), price: parseInt(t.price) }))
    .filter((t) => !isNaN(t.hours) && !isNaN(t.price));

  return {
    key: form.key.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    isActive: form.isActive,
    isFixedPrice: form.isFixedPrice,
    fixedPrice: form.isFixedPrice && form.fixedPrice ? parseInt(form.fixedPrice) : null,
    pricePerHour: !form.isFixedPrice && form.pricePerHour ? parseInt(form.pricePerHour) : null,
    pricingTiers: form.isFixedPrice ? [] : tiers,
    note: form.note.trim() || null,
    sortOrder: parseInt(form.sortOrder) || 0,
  };
}

function formatRupiah(val: number) {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function AdminServices() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<AdditionalEquipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm>({ name: "", pricePerHour: "", serviceKeys: [], isActive: true, sortOrder: "0" });
  const [deleteEquipmentTarget, setDeleteEquipmentTarget] = useState<AdditionalEquipment | null>(null);

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
  });
  
  const { data: schedule = [], isLoading: loadingSchedule } = useQuery<OperationalSchedule[]>({
    queryKey: ["/api/operational-schedule"],
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ dayOfWeek, payload }: { dayOfWeek: number; payload: Partial<Omit<OperationalSchedule, "dayOfWeek">> }) => {
      const res = await apiRequest("PATCH", `/api/admin/operational-schedule/${dayOfWeek}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operational-schedule"] });
    },
    onError: () => {
      toast({ title: "Gagal menyimpan jadwal", variant: "destructive" });
    },
  });

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery<AdditionalEquipment[]>({
    queryKey: ["/api/admin/equipment"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/services", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      closeDialog();
      toast({ title: "Layanan berhasil ditambahkan" });
    },
    onError: () => {
      toast({ title: "Gagal menambahkan layanan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/services/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      closeDialog();
      toast({ title: "Layanan berhasil diperbarui" });
    },
    onError: () => {
      toast({ title: "Gagal memperbarui layanan", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/services/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: () => {
      toast({ title: "Gagal mengubah status layanan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/services/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDeleteTarget(null);
      toast({ title: "Layanan berhasil dihapus" });
    },
    onError: () => {
      toast({ title: "Gagal menghapus layanan", variant: "destructive" });
    },
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/equipment", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      closeEquipmentDialog();
      toast({ title: "Alat berhasil ditambahkan" });
    },
    onError: (error: Error) => {
      toast({ title: "Gagal menambahkan alat", description: error.message, variant: "destructive" });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/equipment/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      closeEquipmentDialog();
      toast({ title: "Alat berhasil diperbarui" });
    },
    onError: (error: Error) => {
      toast({ title: "Gagal memperbarui alat", description: error.message, variant: "destructive" });
    },
  });

  const toggleEquipmentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/equipment/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
    },
    onError: () => {
      toast({ title: "Gagal mengubah status alat", variant: "destructive" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/equipment/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      setDeleteEquipmentTarget(null);
      toast({ title: "Alat berhasil dihapus" });
    },
    onError: () => {
      toast({ title: "Gagal menghapus alat", variant: "destructive" });
    },
  });

  function openAdd() {
    setEditingService(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(svc: Service) {
    setEditingService(svc);
    setForm(serviceToForm(svc));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingService(null);
    setForm(emptyForm());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = formToPayload(form);
    if (!payload.name || !payload.key) {
      toast({ title: "Nama dan key layanan wajib diisi", variant: "destructive" });
      return;
    }
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addTier() {
    setForm((f) => ({ ...f, pricingTiers: [...f.pricingTiers, { hours: "", price: "" }] }));
  }

  function removeTier(idx: number) {
    setForm((f) => ({ ...f, pricingTiers: f.pricingTiers.filter((_, i) => i !== idx) }));
  }

  function updateTier(idx: number, field: "hours" | "price", val: string) {
    setForm((f) => {
      const tiers = [...f.pricingTiers];
      tiers[idx] = { ...tiers[idx], [field]: val };
      return { ...f, pricingTiers: tiers };
    });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openAddEquipment() {
    setEditingEquipment(null);
    const nextOrder = String(equipmentList.length + 1);
    setEquipmentForm({ name: "", pricePerHour: "", serviceKeys: [], isActive: true, sortOrder: nextOrder });
    setEquipmentDialogOpen(true);
  }

  function openEditEquipment(eq: AdditionalEquipment) {
    setEditingEquipment(eq);
    const serviceKeys = (eq.serviceKeys as string[] | null) || [];
    setEquipmentForm({
      name: eq.name,
      pricePerHour: String(eq.pricePerHour),
      serviceKeys,
      isActive: eq.isActive,
      sortOrder: String(eq.sortOrder),
    });
    setEquipmentDialogOpen(true);
  }

  function closeEquipmentDialog() {
    setEquipmentDialogOpen(false);
    setEditingEquipment(null);
    setEquipmentForm({ name: "", pricePerHour: "", serviceKeys: [], isActive: true, sortOrder: "0" });
  }

  function toggleServiceKey(serviceKey: string) {
    setEquipmentForm((f) => {
      const keys = [...f.serviceKeys];
      if (keys.includes(serviceKey)) {
        return { ...f, serviceKeys: keys.filter((k) => k !== serviceKey) };
      } else {
        return { ...f, serviceKeys: [...keys, serviceKey] };
      }
    });
  }

  function handleEquipmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentForm.name || !equipmentForm.pricePerHour) {
      toast({ title: "Nama dan harga alat wajib diisi", variant: "destructive" });
      return;
    }
    const payload = {
      name: equipmentForm.name.trim(),
      pricePerHour: parseInt(equipmentForm.pricePerHour),
      serviceKeys: equipmentForm.serviceKeys,
      isActive: equipmentForm.isActive,
      sortOrder: parseInt(equipmentForm.sortOrder) || 0,
    };
    if (editingEquipment) {
      updateEquipmentMutation.mutate({ id: editingEquipment.id, payload });
    } else {
      createEquipmentMutation.mutate(payload);
    }
  }

  const isSavingEquipment = createEquipmentMutation.isPending || updateEquipmentMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-services-title">Pengaturan Layanan</h1>
          <p className="text-sm text-muted-foreground">Kelola layanan dan harga yang tersedia untuk pelanggan</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-service" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Tambah Layanan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <Card className="p-8 text-center">
          <Music className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada layanan. Klik "Tambah Layanan" untuk mulai.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => {
            const tiers = (svc.pricingTiers as PricingTier[] | null) || [];
            const isExpanded = expandedId === svc.id;

            return (
              <Card key={svc.id} className={`overflow-hidden transition-all ${!svc.isActive ? "opacity-60" : ""}`} data-testid={`card-service-${svc.id}`}>
                <div className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-service-name-${svc.id}`}>{svc.name}</span>
                      {!svc.isActive && (
                        <Badge variant="secondary" className="text-[10px]">Tersembunyi</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {svc.isFixedPrice
                        ? `Harga tetap: ${formatRupiah(svc.fixedPrice || 0)}`
                        : `${formatRupiah(svc.pricePerHour || 0)}/jam${tiers.length > 0 ? ` • ${tiers.length} harga spesial` : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Switch
                      checked={svc.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: svc.id, isActive: checked })}
                      data-testid={`switch-service-${svc.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEdit(svc)}
                      data-testid={`button-edit-service-${svc.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget(svc)}
                      data-testid={`button-delete-service-${svc.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                      data-testid={`button-expand-service-${svc.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-2 text-sm">
                    {svc.description && (
                      <p className="text-muted-foreground">{svc.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-muted-foreground">Key</span>
                      <span className="font-mono text-xs">{svc.key}</span>
                      <span className="text-muted-foreground">Jenis harga</span>
                      <span>{svc.isFixedPrice ? "Harga tetap" : "Per jam"}</span>
                      {svc.isFixedPrice ? (
                        <>
                          <span className="text-muted-foreground">Harga</span>
                          <span className="font-semibold">{formatRupiah(svc.fixedPrice || 0)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Harga per jam</span>
                          <span className="font-semibold">{formatRupiah(svc.pricePerHour || 0)}</span>
                          {tiers.length > 0 && (
                            <>
                              <span className="text-muted-foreground">Harga spesial</span>
                              <div className="space-y-0.5">
                                {tiers.map((t, i) => (
                                  <div key={i}>{t.hours} jam → {formatRupiah(t.price)}</div>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                      {svc.note && (
                        <>
                          <span className="text-muted-foreground">Catatan</span>
                          <span>{svc.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="border-t pt-6 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Alat Tambahan</h2>
            <p className="text-sm text-muted-foreground">Kelola alat musik tambahan yang bisa ditambahkan ke layanan</p>
          </div>
          <Button onClick={openAddEquipment} data-testid="button-add-equipment" className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            Tambah Alat
          </Button>
        </div>

        {loadingEquipment ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : equipment.length === 0 ? (
          <Card className="p-8 text-center">
            <Music className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada alat. Klik "Tambah Alat" untuk mulai.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {equipment.map((eq) => (
              <Card key={eq.id} className={`overflow-hidden transition-all ${!eq.isActive ? "opacity-60" : ""}`} data-testid={`card-equipment-${eq.id}`}>
                <div className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-equipment-name-${eq.id}`}>{eq.name}</span>
                      {!eq.isActive && (
                        <Badge variant="secondary" className="text-[10px]">Tersembunyi</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-equipment-price-${eq.id}`}>{formatRupiah(eq.pricePerHour)}/jam</p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Switch
                      checked={eq.isActive}
                      onCheckedChange={(checked) => toggleEquipmentMutation.mutate({ id: eq.id, isActive: checked })}
                      data-testid={`switch-equipment-${eq.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEditEquipment(eq)}
                      data-testid={`button-edit-equipment-${eq.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteEquipmentTarget(eq)}
                      data-testid={`button-delete-equipment-${eq.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-6 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold">Jam Operasional</h2>
            <p className="text-sm text-muted-foreground">Atur hari buka/libur dan jam operasional studio</p>
          </div>
        </div>

        {loadingSchedule ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { dow: 1, label: "Senin" }, { dow: 2, label: "Selasa" }, { dow: 3, label: "Rabu" },
              { dow: 4, label: "Kamis" }, { dow: 5, label: "Jumat" }, { dow: 6, label: "Sabtu" },
              { dow: 0, label: "Minggu" },
            ].map(({ dow, label }) => {
              const day = schedule.find((s) => s.dayOfWeek === dow) ?? { dayOfWeek: dow, isOpen: true, openHour: 9, closeHour: 23 };
              return (
                <Card key={dow} className={`p-3 transition-colors ${!day.isOpen ? "border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.isOpen}
                      onCheckedChange={(checked) =>
                        updateScheduleMutation.mutate({ dayOfWeek: dow, payload: { isOpen: checked } })
                      }
                      data-testid={`switch-schedule-${dow}`}
                    />
                    <span className={`text-sm font-medium flex-1 ${!day.isOpen ? "text-red-600 dark:text-red-400" : ""}`}>{label}</span>
                    {!day.isOpen && (
                      <span className="text-xs text-red-500 dark:text-red-400 italic">Libur / Tutup</span>
                    )}
                  </div>
                  {day.isOpen && (
                    <div className="flex items-center gap-2 mt-2 ml-[52px] flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Buka</span>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={day.openHour}
                          onChange={(e) =>
                            updateScheduleMutation.mutate({ dayOfWeek: dow, payload: { openHour: parseInt(e.target.value) || 0 } })
                          }
                          className="w-14 h-7 text-center text-sm"
                          data-testid={`input-open-hour-${dow}`}
                        />
                        <span className="text-xs text-muted-foreground">:00</span>
                      </div>
                      <span className="text-xs text-muted-foreground">—</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Tutup</span>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          value={day.closeHour}
                          onChange={(e) =>
                            updateScheduleMutation.mutate({ dayOfWeek: dow, payload: { closeHour: parseInt(e.target.value) || 0 } })
                          }
                          className="w-14 h-7 text-center text-sm"
                          data-testid={`input-close-hour-${dow}`}
                        />
                        <span className="text-xs text-muted-foreground">{day.closeHour >= 24 ? ":00 (+1)" : ":00"}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Layanan" : "Tambah Layanan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nama Layanan *</label>
                <Input
                  placeholder="Rehearsal / Latihan"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  data-testid="input-service-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Key (unik) *</label>
                <Input
                  placeholder="rehearsal"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  disabled={!!editingService}
                  data-testid="input-service-key"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Deskripsi Singkat</label>
              <Input
                placeholder="Latihan band dengan alat lengkap"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                data-testid="input-service-desc"
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Harga Tetap</p>
                <p className="text-xs text-muted-foreground">Aktifkan jika layanan ini memiliki satu harga tetap (tidak per jam)</p>
              </div>
              <Switch
                checked={form.isFixedPrice}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isFixedPrice: checked }))}
                data-testid="switch-fixed-price"
              />
            </div>

            {form.isFixedPrice ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Harga Tetap (Rp)</label>
                <Input
                  type="number"
                  placeholder="500000"
                  value={form.fixedPrice}
                  onChange={(e) => setForm((f) => ({ ...f, fixedPrice: e.target.value }))}
                  data-testid="input-fixed-price"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Harga per Jam (Rp)</label>
                  <Input
                    type="number"
                    placeholder="65000"
                    value={form.pricePerHour}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerHour: e.target.value }))}
                    data-testid="input-price-per-hour"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Harga Spesial (opsional)</label>
                    <Button type="button" size="sm" variant="outline" onClick={addTier} data-testid="button-add-tier">
                      <Plus className="mr-1 h-3 w-3" />
                      Tambah
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Contoh: 3 jam dengan harga khusus Rp 190.000</p>
                  {form.pricingTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number"
                          placeholder="3"
                          value={tier.hours}
                          onChange={(e) => updateTier(idx, "hours", e.target.value)}
                          className="w-20"
                          data-testid={`input-tier-hours-${idx}`}
                        />
                        <span className="text-sm text-muted-foreground shrink-0">jam</span>
                        <span className="text-sm text-muted-foreground shrink-0">=</span>
                        <span className="text-sm text-muted-foreground shrink-0">Rp</span>
                        <Input
                          type="number"
                          placeholder="190000"
                          value={tier.price}
                          onChange={(e) => updateTier(idx, "price", e.target.value)}
                          className="flex-1"
                          data-testid={`input-tier-price-${idx}`}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeTier(idx)}
                        data-testid={`button-remove-tier-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Catatan (opsional)</label>
              <Input
                placeholder="Per jam. Output: master lagu WAV"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                data-testid="input-service-note"
              />
              <p className="text-xs text-muted-foreground">Ditampilkan di daftar harga sebagai keterangan tambahan</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Urutan Tampil</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  data-testid="input-service-order"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  data-testid="switch-service-active"
                />
                <span className="text-sm">{form.isActive ? "Aktif" : "Disembunyikan"}</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSaving}
              data-testid="button-save-service"
            >
              {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {editingService ? "Simpan Perubahan" : "Tambah Layanan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Layanan</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus layanan "{deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-service">Batalkan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-service"
            >
              {deleteMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={equipmentDialogOpen} onOpenChange={(open) => !open && closeEquipmentDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingEquipment ? "Edit Alat" : "Tambah Alat"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEquipmentSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama Alat *</label>
              <Input
                placeholder="Keyboard"
                value={equipmentForm.name}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="input-equipment-name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Harga per Jam (Rp) *</label>
              <Input
                type="number"
                placeholder="10000"
                value={equipmentForm.pricePerHour}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, pricePerHour: e.target.value }))}
                data-testid="input-equipment-price"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tersedia di Layanan</label>
              <div className="space-y-2">
                {services.map((svc) => (
                  <div key={svc.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`service-${svc.id}`}
                      checked={equipmentForm.serviceKeys.includes(svc.key)}
                      onChange={() => toggleServiceKey(svc.key)}
                      className="rounded border"
                      data-testid={`checkbox-service-${svc.key}`}
                    />
                    <label htmlFor={`service-${svc.id}`} className="text-sm cursor-pointer">
                      {svc.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Switch
                checked={equipmentForm.isActive}
                onCheckedChange={(checked) => setEquipmentForm((f) => ({ ...f, isActive: checked }))}
                data-testid="switch-equipment-active"
              />
              <span className="text-sm">{equipmentForm.isActive ? "Aktif" : "Disembunyikan"}</span>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSavingEquipment}
              data-testid="button-save-equipment"
            >
              {isSavingEquipment && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {editingEquipment ? "Simpan Perubahan" : "Tambah Alat"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEquipmentTarget} onOpenChange={(open) => !open && setDeleteEquipmentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Alat</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus alat "{deleteEquipmentTarget?.name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-equipment">Batalkan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteEquipmentTarget && deleteEquipmentMutation.mutate(deleteEquipmentTarget.id)}
              disabled={deleteEquipmentMutation.isPending}
              data-testid="button-confirm-delete-equipment"
            >
              {deleteEquipmentMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
