import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Procedure {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: string | number;
  cost: string | number;
  description?: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "estetica", label: "Estética" },
  { value: "pilates", label: "Pilates" },
];

const CATEGORY_COLORS: Record<string, string> = {
  fisioterapia: "bg-blue-100 text-blue-800",
  estetica: "bg-pink-100 text-pink-800",
  pilates: "bg-purple-100 text-purple-800",
};

export default function Procedimentos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "fisioterapia",
    durationMinutes: 60,
    price: "",
    cost: "",
    description: "",
  });

  const url = selectedCategory === "all"
    ? "/api/procedures"
    : `/api/procedures?category=${selectedCategory}`;

  const { data: procedures = [], isLoading } = useQuery<Procedure[]>({
    queryKey: ["procedures", selectedCategory],
    queryFn: () => fetch(url).then(r => r.json()),
  });

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
    mutationFn: (id: number) =>
      fetch(`/api/procedures/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast({ title: "Procedimento removido" });
    },
  });

  function resetForm() {
    setForm({ name: "", category: "fisioterapia", durationMinutes: 60, price: "", cost: "", description: "" });
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

  function formatCurrency(value: string | number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
  }

  function getMargin(price: string | number, cost: string | number) {
    const p = Number(price);
    const c = Number(cost);
    if (p === 0) return 0;
    return ((p - c) / p) * 100;
  }

  return (
    <AppLayout title="Procedimentos">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Procedimentos</h1>
            <p className="text-muted-foreground">Gerencie os procedimentos e serviços da clínica</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingProcedure(null); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Procedimento
          </Button>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList>
            {CATEGORIES.map(c => (
              <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : procedures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum procedimento encontrado.</p>
            <Button className="mt-4" variant="outline" onClick={() => setIsModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar procedimento
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {procedures.map((proc) => (
              <div key={proc.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{proc.name}</h3>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[proc.category] ?? "bg-gray-100 text-gray-800"}`}>
                      {proc.category}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(proc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(proc.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {proc.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{proc.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{proc.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>{formatCurrency(proc.price)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Custo: {formatCurrency(proc.cost ?? 0)}
                  </div>
                  <div className="text-xs text-green-600 font-medium">
                    Margem: {getMargin(proc.price, proc.cost ?? 0).toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setEditingProcedure(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProcedure ? "Editar Procedimento" : "Novo Procedimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Fisioterapia Ortopédica" />
            </div>
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="estetica">Estética</SelectItem>
                  <SelectItem value="pilates">Pilates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Duração (min) *</Label>
                <Input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))} />
              </div>
              <div className="space-y-1">
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descrição do procedimento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); setEditingProcedure(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingProcedure ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
