import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Activity,
  ChevronRight,
  Infinity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE.replace(/\/$/, "").replace(/\/[^/]+$/, "");

const api = (path: string) => `${API_BASE}/api${path}`;

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ao carregar dados");
  return res.json();
}

const TABS = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "planos", label: "Planos", icon: Package },
  { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  trial:     { label: "Trial",     color: "text-blue-700",   bg: "bg-blue-50",   dot: "bg-blue-400"   },
  active:    { label: "Ativo",     color: "text-green-700",  bg: "bg-green-50",  dot: "bg-green-500"  },
  suspended: { label: "Suspenso",  color: "text-amber-700",  bg: "bg-amber-50",  dot: "bg-amber-400"  },
  cancelled: { label: "Cancelado", color: "text-red-700",    bg: "bg-red-50",    dot: "bg-red-400"    },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "text-amber-700", bg: "bg-amber-50" },
  paid:    { label: "Pago",     color: "text-green-700", bg: "bg-green-50" },
  overdue: { label: "Vencido",  color: "text-red-700",   bg: "bg-red-50"   },
  free:    { label: "Grátis",   color: "text-slate-700", bg: "bg-slate-100" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.trial;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const cfg = PAYMENT_CONFIG[status] ?? PAYMENT_CONFIG.pending;
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-5">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: color }} />
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl" style={{ backgroundColor: color + "18" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

function fmtCurrency(v?: string | number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function limitLabel(v: number | null | undefined) {
  if (v == null) return <Infinity className="w-4 h-4 text-slate-400 inline-block" />;
  return v;
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────

type Plan = {
  id: number;
  name: string;
  displayName: string;
  description: string;
  price: string;
  maxProfessionals: number | null;
  maxPatients: number | null;
  maxSchedules: number | null;
  maxUsers: number | null;
  trialDays: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_PLAN: Omit<Plan, "id" | "name"> & { name: string } = {
  name: "",
  displayName: "",
  description: "",
  price: "0",
  maxProfessionals: 1,
  maxPatients: null,
  maxSchedules: null,
  maxUsers: null,
  trialDays: 30,
  features: [],
  isActive: true,
  sortOrder: 0,
};

function PlansTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_PLAN>(EMPTY_PLAN);
  const [featuresText, setFeaturesText] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON(api("/plans")),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        price: Number(form.price),
        features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const url = editPlan ? api(`/plans/${editPlan.id}`) : api("/plans");
      const method = editPlan ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Erro ao salvar plano");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: editPlan ? "Plano atualizado!" : "Plano criado!" });
      setEditPlan(null);
      setCreating(false);
      setForm(EMPTY_PLAN);
      setFeaturesText("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(api(`/plans/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plano excluído" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setForm({ ...plan });
    setFeaturesText((plan.features ?? []).join("\n"));
  };

  const openCreate = () => {
    setCreating(true);
    setEditPlan(null);
    setForm(EMPTY_PLAN);
    setFeaturesText("");
  };

  const isOpen = creating || editPlan !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Planos de Adesão</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie preços, limites e recursos de cada plano</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Novo Plano
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Preço/mês</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Profissionais</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Pacientes</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Agendas</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Usuários</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trial</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-800">{plan.displayName}</p>
                      <p className="text-xs text-slate-400">{plan.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-slate-800">
                    {fmtCurrency(plan.price)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxProfessionals)}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxPatients)}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxSchedules)}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxUsers)}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{plan.trialDays}d</TableCell>
                  <TableCell className="text-center">
                    {plan.isActive ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Ativo</span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(plan)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteId(plan.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit / Create dialog */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setCreating(false); setEditPlan(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            <DialogDescription>Configure os limites e recursos do plano</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Identificador (slug)</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="essencial"
                  disabled={!!editPlan}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome de Exibição</Label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Essencial" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição curta</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Para profissionais autônomos" className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Preço mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Dias de Trial</Label>
                <Input type="number" min={0} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} className="rounded-xl" />
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest pt-2">Limites (vazio = ilimitado)</p>
            <div className="grid grid-cols-2 gap-4">
              {([
                ["maxProfessionals", "Profissionais"],
                ["maxPatients", "Pacientes"],
                ["maxSchedules", "Agendas"],
                ["maxUsers", "Usuários totais"],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    value={form[field] ?? ""}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value ? Number(e.target.value) : null })}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Recursos (um por linha)</Label>
              <Textarea
                rows={5}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder={"Agenda completa\nProntuários digitais\nControle financeiro"}
                className="rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ordem de exibição</Label>
                <Input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="rounded-xl" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>Plano ativo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditPlan(null); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : editPlan ? "Salvar" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Plano</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita. Clínicas ativas com este plano perderão a referência.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

type SubRow = {
  sub: {
    id: number;
    clinicId: number;
    planId: number;
    status: string;
    trialStartDate: string | null;
    trialEndDate: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    amount: string | null;
    paymentStatus: string;
    paidAt: string | null;
    notes: string | null;
    createdAt: string;
  };
  clinic: { id: number; name: string; email: string | null; isActive: boolean; createdAt: string } | null;
  plan: Plan | null;
};

function SubscriptionsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editSub, setEditSub] = useState<SubRow | null>(null);
  const [subForm, setSubForm] = useState<{
    status: string;
    planId: string;
    paymentStatus: string;
    amount: string;
    trialEndDate: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    notes: string;
  }>({
    status: "trial",
    planId: "",
    paymentStatus: "pending",
    amount: "",
    trialEndDate: "",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    notes: "",
  });

  const { data: subs = [], isLoading } = useQuery<SubRow[]>({
    queryKey: ["clinic-subscriptions"],
    queryFn: () => fetchJSON(api("/clinic-subscriptions")),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON(api("/plans")),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editSub) return;
      const payload = {
        planId: Number(subForm.planId) || undefined,
        status: subForm.status || undefined,
        paymentStatus: subForm.paymentStatus || undefined,
        amount: subForm.amount ? Number(subForm.amount) : undefined,
        trialEndDate: subForm.trialEndDate || undefined,
        currentPeriodStart: subForm.currentPeriodStart || undefined,
        currentPeriodEnd: subForm.currentPeriodEnd || undefined,
        notes: subForm.notes || undefined,
      };
      const res = await fetch(api(`/clinic-subscriptions/${editSub.sub.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Erro ao atualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
      toast({ title: "Assinatura atualizada!" });
      setEditSub(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const openEdit = (row: SubRow) => {
    setEditSub(row);
    setSubForm({
      status: row.sub.status,
      planId: String(row.sub.planId),
      paymentStatus: row.sub.paymentStatus,
      amount: row.sub.amount ?? "",
      trialEndDate: row.sub.trialEndDate ?? "",
      currentPeriodStart: row.sub.currentPeriodStart ?? "",
      currentPeriodEnd: row.sub.currentPeriodEnd ?? "",
      notes: row.sub.notes ?? "",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Assinaturas das Clínicas</h2>
        <p className="text-sm text-slate-500 mt-0.5">Acompanhe o status e os pagamentos de cada clínica</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma assinatura encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Assinaturas são criadas automaticamente ao cadastrar uma clínica</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clínica</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trial até</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Pagamento</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cadastro</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((row) => (
                <TableRow key={row.sub.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{row.clinic?.name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{row.clinic?.email ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-slate-700">{row.plan?.displayName ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.sub.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {fmtDate(row.sub.trialEndDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-slate-700">
                    {fmtCurrency(row.sub.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <PaymentBadge status={row.sub.paymentStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {fmtDate(row.sub.createdAt?.split("T")[0])}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(row)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit subscription dialog */}
      <Dialog open={editSub !== null} onOpenChange={(o) => { if (!o) setEditSub(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Assinatura</DialogTitle>
            <DialogDescription>
              {editSub?.clinic?.name} — altere plano, status e pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={subForm.planId} onValueChange={(v) => setSubForm({ ...subForm, planId: v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status da Assinatura</Label>
                <Select value={subForm.status} onValueChange={(v) => setSubForm({ ...subForm, status: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status do Pagamento</Label>
                <Select value={subForm.paymentStatus} onValueChange={(v) => setSubForm({ ...subForm, paymentStatus: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="free">Grátis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Valor cobrado (R$)</Label>
              <Input type="number" min={0} step={0.01} value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })} className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label>Trial válido até</Label>
              <Input type="date" value={subForm.trialEndDate} onChange={(e) => setSubForm({ ...subForm, trialEndDate: e.target.value })} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Início do período</Label>
                <Input type="date" value={subForm.currentPeriodStart} onChange={(e) => setSubForm({ ...subForm, currentPeriodStart: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Fim do período</Label>
                <Input type="date" value={subForm.currentPeriodEnd} onChange={(e) => setSubForm({ ...subForm, currentPeriodEnd: e.target.value })} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={subForm.notes} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} className="rounded-xl text-sm" placeholder="Notas internas..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSub(null)}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Dashboard / Painel Tab ───────────────────────────────────────────────────

function PainelTab() {
  const { data: subs = [], isLoading } = useQuery<SubRow[]>({
    queryKey: ["clinic-subscriptions"],
    queryFn: () => fetchJSON(api("/clinic-subscriptions")),
  });

  const total = subs.length;
  const trial = subs.filter((s) => s.sub.status === "trial").length;
  const active = subs.filter((s) => s.sub.status === "active").length;
  const suspended = subs.filter((s) => s.sub.status === "suspended" || s.sub.status === "cancelled").length;
  const overdue = subs.filter((s) => s.sub.paymentStatus === "overdue").length;
  const mrr = subs
    .filter((s) => s.sub.status === "active" && s.sub.paymentStatus === "paid")
    .reduce((acc, s) => acc + Number(s.sub.amount ?? 0), 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Painel Geral</h2>
        <p className="text-sm text-slate-500 mt-0.5">Visão consolidada das clínicas e assinaturas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total de Clínicas" value={total} icon={Building2} color="#6366f1" />
        <KpiCard label="Em Trial" value={trial} sub="período gratuito" icon={Clock} color="#0ea5e9" />
        <KpiCard label="Assinaturas Ativas" value={active} icon={CheckCircle} color="#10b981" />
        <KpiCard label="Suspensas / Canceladas" value={suspended} icon={XCircle} color="#ef4444" />
        <KpiCard label="Inadimplentes" value={overdue} icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="MRR (estimado)" value={fmtCurrency(mrr)} sub="mensalidades pagas ativas" icon={TrendingUp} color="#8b5cf6" />
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Assinaturas recentes</h3>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clínica</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Pagamento</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.slice(0, 10).map((row) => (
                <TableRow key={row.sub.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <TableCell className="font-medium text-sm text-slate-800">{row.clinic?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{row.plan?.displayName ?? "—"}</TableCell>
                  <TableCell className="text-center"><StatusBadge status={row.sub.status} /></TableCell>
                  <TableCell className="text-center"><PaymentBadge status={row.sub.paymentStatus} /></TableCell>
                  <TableCell className="text-sm text-slate-500">{fmtDate(row.sub.createdAt?.split("T")[0])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>("painel");

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Painel SuperAdmin</h1>
            <p className="text-sm text-slate-500">Gestão de planos de adesão e assinaturas das clínicas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                activeTab === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "painel" && <PainelTab />}
        {activeTab === "planos" && <PlansTab />}
        {activeTab === "assinaturas" && <SubscriptionsTab />}
      </div>
    </AppLayout>
  );
}
