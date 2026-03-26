import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  CalendarDays,
  Users,
  Clock,
  Layers,
  TrendingUp,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Procedure {
  id: number;
  name: string;
  category: string;
  modalidade: string;
  price: string | number;
  durationMinutes: number;
  isActive: boolean;
}

interface PackageItem {
  id: number;
  name: string;
  description?: string;
  procedureId: number;
  procedureName: string;
  procedureCategory: string;
  procedureModalidade: string;
  totalSessions: number;
  sessionsPerWeek: number;
  validityDays: number;
  price: string | number;
  isActive: boolean;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  fisioterapia: { label: "Fisioterapia", bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-400" },
  estetica:     { label: "Estética",     bg: "bg-pink-50",   text: "text-pink-700",  dot: "bg-pink-400" },
  pilates:      { label: "Pilates",      bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
};

const MODALIDADE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  individual: { label: "Individual", icon: User },
  dupla:      { label: "Dupla",      icon: Users },
  grupo:      { label: "Grupo",      icon: Users },
};

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full", cfg.bg, cfg.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.message || `Erro ${r.status}`);
  }
  if (r.status === 204) return undefined as T;
  return r.json();
}

const EMPTY_FORM = {
  name: "",
  description: "",
  procedureId: "",
  totalSessions: 8,
  sessionsPerWeek: 2,
  validityDays: 30,
  price: "",
};

export default function Pacotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<PackageItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: packages = [], isLoading } = useQuery<PackageItem[]>({
    queryKey: ["packages"],
    queryFn: () => apiFetch<PackageItem[]>("/api/packages?includeInactive=true"),
  });

  const { data: procedures = [] } = useQuery<Procedure[]>({
    queryKey: ["procedures-active"],
    queryFn: () => apiFetch<Procedure[]>("/api/procedures"),
  });

  const filtered = packages.filter((pkg) => {
    const matchesSearch = search.trim() === "" || pkg.name.toLowerCase().includes(search.toLowerCase()) || pkg.procedureName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || pkg.procedureCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<PackageItem>("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          procedureId: Number(data.procedureId),
          totalSessions: Number(data.totalSessions),
          sessionsPerWeek: Number(data.sessionsPerWeek),
          validityDays: Number(data.validityDays),
          price: Number(data.price),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Pacote criado com sucesso!" });
      closeModal();
    },
    onError: (err: Error) => toast({ title: "Erro ao criar pacote", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      apiFetch<PackageItem>(`/api/packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          procedureId: Number(data.procedureId),
          totalSessions: Number(data.totalSessions),
          sessionsPerWeek: Number(data.sessionsPerWeek),
          validityDays: Number(data.validityDays),
          price: Number(data.price),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Pacote atualizado com sucesso!" });
      closeModal();
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar pacote", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/packages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Pacote removido." });
      setDeletingPackage(null);
    },
    onError: (err: Error) => toast({ title: "Erro ao remover pacote", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingPackage(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEdit(pkg: PackageItem) {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      procedureId: String(pkg.procedureId),
      totalSessions: pkg.totalSessions,
      sessionsPerWeek: pkg.sessionsPerWeek,
      validityDays: pkg.validityDays,
      price: String(pkg.price),
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPackage(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.name || !form.procedureId || !form.price) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const pricePerSession = form.price && form.totalSessions
    ? Number(form.price) / Number(form.totalSessions)
    : null;

  const selectedProcedure = procedures.find((p) => p.id === Number(form.procedureId));
  const pricePerSessionOriginal = selectedProcedure ? Number(selectedProcedure.price) : null;
  const discount = pricePerSession && pricePerSessionOriginal && pricePerSessionOriginal > 0
    ? ((pricePerSessionOriginal - pricePerSession) / pricePerSessionOriginal) * 100
    : null;

  const totalPackagesByCategory = packages.reduce((acc, pkg) => {
    acc[pkg.procedureCategory] = (acc[pkg.procedureCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppLayout title="Pacotes">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pacotes de Serviços</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gerencie pacotes de sessões com frequência semanal e validade configuráveis
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Novo Pacote
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{packages.length}</p>
              <p className="text-xs text-muted-foreground">Pacotes cadastrados</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="bg-emerald-100 p-2.5 rounded-lg">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {packages.length > 0
                  ? Math.round(packages.reduce((a, p) => a + p.sessionsPerWeek, 0) / packages.length)
                  : 0}x/sem
              </p>
              <p className="text-xs text-muted-foreground">Frequência média</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {packages.length > 0
                  ? formatCurrency(packages.reduce((a, p) => a + Number(p.price), 0) / packages.length)
                  : "R$ 0"}
              </p>
              <p className="text-xs text-muted-foreground">Ticket médio dos pacotes</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar pacote ou procedimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
              <SelectItem value="estetica">Estética</SelectItem>
              <SelectItem value="pilates">Pilates</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border rounded-xl p-5 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-xl">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-foreground">Nenhum pacote encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || categoryFilter !== "all" ? "Tente outros filtros" : "Crie o primeiro pacote clicando em \"Novo Pacote\""}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((pkg) => {
              const pps = Number(pkg.price) / pkg.totalSessions;
              const modalidadeCfg = MODALIDADE_CONFIG[pkg.procedureModalidade] ?? MODALIDADE_CONFIG.individual;
              const ModalIcon = modalidadeCfg.icon;
              return (
                <div key={pkg.id} className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pkg.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(pkg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingPackage(pkg)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <CategoryBadge category={pkg.procedureCategory} />
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <ModalIcon className="h-3 w-3" />
                      {modalidadeCfg.label}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground font-medium">
                    Procedimento: <span className="text-foreground">{pkg.procedureName}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">{pkg.totalSessions}</p>
                      <p className="text-[10px] text-muted-foreground">sessões</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">{pkg.sessionsPerWeek}x</p>
                      <p className="text-[10px] text-muted-foreground">por semana</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">{pkg.validityDays}</p>
                      <p className="text-[10px] text-muted-foreground">dias validade</p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between pt-1 border-t">
                    <div>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(pkg.price)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(pps)}/sessão
                      </p>
                    </div>
                    {!pkg.isActive && (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do pacote *</Label>
              <Input
                placeholder="Ex: Pilates em Grupo — 8 sessões/mês"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva o pacote para o paciente..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Procedimento *</Label>
              <Select
                value={form.procedureId}
                onValueChange={(v) => setForm((f) => ({ ...f, procedureId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento..." />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {" "}
                      <span className="text-muted-foreground text-xs">
                        ({p.modalidade} · {formatCurrency(p.price)}/sessão)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Total de sessões *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.totalSessions}
                  onChange={(e) => setForm((f) => ({ ...f, totalSessions: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sessões/semana *</Label>
                <Select
                  value={String(form.sessionsPerWeek)}
                  onValueChange={(v) => setForm((f) => ({ ...f, sessionsPerWeek: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}x/sem</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.validityDays}
                  onChange={(e) => setForm((f) => ({ ...f, validityDays: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Preço do pacote (R$) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>

            {pricePerSession !== null && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço por sessão no pacote:</span>
                  <span className="font-semibold">{formatCurrency(pricePerSession)}</span>
                </div>
                {pricePerSessionOriginal && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço avulso do procedimento:</span>
                    <span className="font-semibold">{formatCurrency(pricePerSessionOriginal)}</span>
                  </div>
                )}
                {discount !== null && (
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Desconto para o paciente:</span>
                    <span className={cn("font-bold", discount > 0 ? "text-emerald-600" : "text-red-500")}>
                      {discount > 0 ? `-${discount.toFixed(0)}%` : `+${Math.abs(discount).toFixed(0)}% (acima do avulso)`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground">Duração estimada do pacote:</span>
                  <span className="font-semibold">
                    ~{Math.ceil(form.totalSessions / form.sessionsPerWeek)} semana(s)
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPackage ? "Salvar alterações" : "Criar pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPackage} onOpenChange={(open) => { if (!open) setDeletingPackage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pacote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o pacote <strong>{deletingPackage?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPackage && deleteMutation.mutate(deletingPackage.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
