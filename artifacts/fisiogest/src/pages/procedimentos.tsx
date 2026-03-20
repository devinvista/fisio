import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Clock,
  LayoutGrid,
  LayoutList,
  Search,
  TrendingUp,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Procedure {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: string | number;
  cost: string | number;
  description?: string;
  maxCapacity: number;
  createdAt: string;
}

type ViewMode = "cards" | "list";

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "estetica", label: "Estética" },
  { value: "pilates", label: "Pilates" },
];

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  fisioterapia: { label: "Fisioterapia", bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-400" },
  estetica:     { label: "Estética",     bg: "bg-pink-50",   text: "text-pink-700",  dot: "bg-pink-400" },
  pilates:      { label: "Pilates",      bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
};

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function getMargin(price: string | number, cost: string | number) {
  const p = Number(price);
  const c = Number(cost);
  if (p === 0) return 0;
  return ((p - c) / p) * 100;
}

function MarginBadge({ margin }: { margin: number }) {
  const color = margin >= 60 ? "text-emerald-600" : margin >= 35 ? "text-amber-600" : "text-red-500";
  return <span className={cn("text-xs font-semibold tabular-nums", color)}>{margin.toFixed(0)}%</span>;
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

export default function Procedimentos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [deletingProcedure, setDeletingProcedure] = useState<Procedure | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "fisioterapia",
    durationMinutes: 60,
    price: "",
    cost: "",
    description: "",
    maxCapacity: 1,
  });

  const url = selectedCategory === "all"
    ? "/api/procedures"
    : `/api/procedures?category=${selectedCategory}`;

  const { data: allProcedures = [], isLoading } = useQuery<Procedure[]>({
    queryKey: ["procedures", selectedCategory],
    queryFn: () => fetch(url).then(r => r.json()),
  });

  const procedures = allProcedures.filter(p =>
    search.trim() === "" || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, price: Number(data.price), cost: Number(data.cost) }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: "Procedimento criado com sucesso" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form & { id: number }) =>
      fetch(`/api/procedures/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, price: Number(data.price), cost: Number(data.cost) }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      setIsModalOpen(false);
      setEditingProcedure(null);
      resetForm();
      toast({ title: "Procedimento atualizado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/procedures/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      setDeletingProcedure(null);
      toast({ title: "Procedimento removido" });
    },
  });

  function resetForm() {
    setForm({ name: "", category: "fisioterapia", durationMinutes: 60, price: "", cost: "", description: "", maxCapacity: 1 });
  }

  function openEdit(proc: Procedure) {
    setEditingProcedure(proc);
    setForm({
      name: proc.name,
      category: proc.category,
      durationMinutes: proc.durationMinutes,
      price: String(proc.price),
      cost: String(proc.cost ?? "0"),
      description: proc.description ?? "",
      maxCapacity: proc.maxCapacity ?? 1,
    });
    setIsModalOpen(true);
  }

  function handleSubmit() {
    if (editingProcedure) {
      updateMutation.mutate({ ...form, id: editingProcedure.id });
    } else {
      createMutation.mutate(form);
    }
  }

  const formMargin = getMargin(form.price, form.cost);
  const avgPrice = allProcedures.length ? allProcedures.reduce((s, p) => s + Number(p.price), 0) / allProcedures.length : 0;
  const avgMargin = allProcedures.length ? allProcedures.reduce((s, p) => s + getMargin(p.price, p.cost ?? 0), 0) / allProcedures.length : 0;

  return (
    <AppLayout title="Procedimentos">
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-800">Procedimentos</h1>
            <p className="text-sm text-slate-500">Gerencie os serviços e procedimentos da clínica</p>
          </div>
          <Button
            className="h-9 px-4 rounded-lg shadow-md shadow-primary/20"
            onClick={() => { resetForm(); setEditingProcedure(null); setIsModalOpen(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Novo Procedimento
          </Button>
        </div>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total de procedimentos", value: allProcedures.length, icon: <Stethoscope className="w-4 h-4" />, color: "text-primary" },
            { label: "Preço médio", value: formatCurrency(avgPrice), icon: <span className="text-xs font-bold">R$</span>, color: "text-emerald-600" },
            { label: "Margem média", value: `${avgMargin.toFixed(0)}%`, icon: <TrendingUp className="w-4 h-4" />, color: avgMargin >= 50 ? "text-emerald-600" : "text-amber-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={cn("shrink-0", s.color)}>{s.icon}</div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters + View toggle ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category tabs */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs font-medium bg-white">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setSelectedCategory(c.value)}
                className={cn(
                  "px-3 h-8 transition-colors border-r border-slate-200 last:border-r-0",
                  selectedCategory === c.value ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-600"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar procedimento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm rounded-lg"
            />
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("cards")}
              className={cn("p-1.5 transition-colors", viewMode === "cards" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-500")}
              title="Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 transition-colors border-l border-slate-200", viewMode === "list" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-500")}
              title="Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Carregando...</div>
        ) : procedures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
            <Stethoscope className="w-10 h-10 text-slate-200" />
            <p className="text-sm">Nenhum procedimento encontrado.</p>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setEditingProcedure(null); setIsModalOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar procedimento
            </Button>
          </div>
        ) : viewMode === "cards" ? (
          <CardView procedures={procedures} onEdit={openEdit} onDelete={setDeletingProcedure} />
        ) : (
          <ListView procedures={procedures} onEdit={openEdit} onDelete={setDeletingProcedure} />
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={open => { if (!open) { setIsModalOpen(false); setEditingProcedure(null); resetForm(); } }}>
        <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingProcedure ? "Editar Procedimento" : "Novo Procedimento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Fisioterapia Ortopédica"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="estetica">Estética</SelectItem>
                  <SelectItem value="pilates">Pilates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Duração (min) *</Label>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label>Vagas simultâneas</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxCapacity}
                  onChange={e => setForm(f => ({ ...f, maxCapacity: parseInt(e.target.value) || 1 }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0,00"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="0,00"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Real-time margin preview */}
            {form.price !== "" && (
              <div className={cn(
                "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm",
                formMargin >= 60 ? "bg-emerald-50 text-emerald-700"
                  : formMargin >= 35 ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-600"
              )}>
                <span className="font-medium">Margem de contribuição</span>
                <span className="font-bold text-base">{formMargin.toFixed(1)}%</span>
              </div>
            )}

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Descrição do procedimento..."
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => { setIsModalOpen(false); setEditingProcedure(null); resetForm(); }}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={!form.name || !form.price || createMutation.isPending || updateMutation.isPending}
            >
              {editingProcedure ? "Salvar alterações" : "Criar procedimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deletingProcedure} onOpenChange={open => { if (!open) setDeletingProcedure(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover procedimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O procedimento <strong>"{deletingProcedure?.name}"</strong> será removido permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingProcedure && deleteMutation.mutate(deletingProcedure.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── Card View ────────────────────────────────────────────────────────────────

function CardView({ procedures, onEdit, onDelete }: {
  procedures: Procedure[];
  onEdit: (p: Procedure) => void;
  onDelete: (p: Procedure) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {procedures.map(proc => {
        const margin = getMargin(proc.price, proc.cost ?? 0);
        const marginColor = margin >= 60 ? "bg-emerald-500" : margin >= 35 ? "bg-amber-400" : "bg-red-400";

        return (
          <div
            key={proc.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group"
          >
            {/* Top bar accent */}
            <div className={cn("h-1 w-full", marginColor)} />

            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 leading-snug truncate">{proc.name}</h3>
                  <div className="mt-1.5">
                    <CategoryBadge category={proc.category} />
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onEdit(proc)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(proc)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {proc.description && (
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{proc.description}</p>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Preço</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(proc.price)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Margem</p>
                  <MarginBadge margin={margin} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Duração</p>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{proc.durationMinutes} min
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Custo</p>
                  <p className="text-xs text-slate-500">{formatCurrency(proc.cost ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ procedures, onEdit, onDelete }: {
  procedures: Procedure[];
  onEdit: (p: Procedure) => void;
  onDelete: (p: Procedure) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div className="grid items-center border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"
        style={{ gridTemplateColumns: "1fr 120px 90px 90px 70px 70px 72px" }}
      >
        <span>Procedimento</span>
        <span>Categoria</span>
        <span className="text-right">Preço</span>
        <span className="text-right">Custo</span>
        <span className="text-right">Margem</span>
        <span className="text-right">Duração</span>
        <span />
      </div>

      {/* Rows */}
      {procedures.map((proc, idx) => {
        const margin = getMargin(proc.price, proc.cost ?? 0);
        return (
          <div
            key={proc.id}
            className={cn(
              "grid items-center px-4 py-3 hover:bg-slate-50/70 transition-colors group",
              idx !== procedures.length - 1 && "border-b border-slate-100"
            )}
            style={{ gridTemplateColumns: "1fr 120px 90px 90px 70px 70px 72px" }}
          >
            <div className="min-w-0 pr-3">
              <p className="font-medium text-sm text-slate-800 truncate">{proc.name}</p>
              {proc.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{proc.description}</p>
              )}
            </div>

            <div><CategoryBadge category={proc.category} /></div>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{formatCurrency(proc.price)}</p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">{formatCurrency(proc.cost ?? 0)}</p>
            </div>

            <div className="text-right">
              <MarginBadge margin={margin} />
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" />{proc.durationMinutes}m
              </p>
            </div>

            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(proc)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(proc)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
