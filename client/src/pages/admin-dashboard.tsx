import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { format } from "date-fns";
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

export default function AdminDashboard() {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<DailyCost | null>(null);
  const [costAmount, setCostAmount] = useState("");
  const [costDesc, setCostDesc] = useState("");
  const [deleteCostTarget, setDeleteCostTarget] = useState<DailyCost | null>(null);

  const { data: bookings = [], isLoading: loadingBookings } =
    useQuery<Booking[]>({
      queryKey: ["/api/admin/bookings", selectedDate],
    });

  const { data: costs = [], isLoading: loadingCosts } =
    useQuery<DailyCost[]>({
      queryKey: ["/api/admin/costs", selectedDate],
    });

  const addCostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/costs", {
        tanggal: selectedDate,
        cost: parseInt(costAmount),
        keterangan: costDesc,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/costs", selectedDate],
      });
      closeCostDialog();
      toast({ title: "Pengeluaran berhasil ditambahkan" });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal menambahkan pengeluaran",
        description: error.message,
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/costs", selectedDate],
      });
      closeCostDialog();
      toast({ title: "Pengeluaran berhasil diperbarui" });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal memperbarui pengeluaran",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/costs", selectedDate],
      });
      setDeleteCostTarget(null);
      toast({ title: "Pengeluaran berhasil dihapus" });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal menghapus pengeluaran",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function openAddCost() {
    setEditingCost(null);
    setCostAmount("");
    setCostDesc("");
    setCostDialogOpen(true);
  }

  function openEditCost(cost: DailyCost) {
    setEditingCost(cost);
    setCostAmount(String(cost.cost));
    setCostDesc(cost.keterangan);
    setCostDialogOpen(true);
  }

  function closeCostDialog() {
    setCostDialogOpen(false);
    setEditingCost(null);
    setCostAmount("");
    setCostDesc("");
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

  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed"
  );

  const pendapatan = confirmedBookings.reduce(
    (sum, b) => sum + b.total,
    0
  );

  const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);

  const profit = pendapatan - totalCost;

  const displayDate = format(
    new Date(selectedDate + "T00:00:00"),
    "EEEE, dd MMMM yyyy",
    { locale: idLocale }
  );

  const isSaving = addCostMutation.isPending || updateCostMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-dashboard-title">Booking Hari Ini</h1>
        <p className="text-sm text-muted-foreground">
          Booking dan profit berdasarkan tanggal
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="max-w-[200px]"
          data-testid="input-date"
        />
      </div>

      <p className="text-sm text-muted-foreground">{displayDate}</p>

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
            value={`Rp ${pendapatan.toLocaleString("id-ID")}`}
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
            <p className="text-sm text-muted-foreground">Belum ada pengeluaran untuk tanggal ini</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {costs.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-3 gap-3" data-testid={`card-cost-${c.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" data-testid={`text-cost-desc-${c.id}`}>{c.keterangan}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-cost-amount-${c.id}`}>
                    Rp {c.cost.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditCost(c)}
                    data-testid={`button-edit-cost-${c.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteCostTarget(c)}
                    data-testid={`button-delete-cost-${c.id}`}
                  >
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
          <h2 className="text-base font-semibold">Booking Konfirmasi</h2>
          <div className="space-y-2">
            {confirmedBookings.map((b) => (
              <Card key={b.id} className="p-3 space-y-1" data-testid={`card-booking-${b.id}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{b.namaBand}</span>
                  <span className="text-sm font-bold">Rp {b.total.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
              </Card>
            ))}
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
