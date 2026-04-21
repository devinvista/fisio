import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Activity,
  Infinity,
  Sparkles,
  Zap,
  Crown,
  Search,
  Filter,
  Check,
  RefreshCw,
  ChevronDown,
  BadgeDollarSign,
  Users,
  BarChart3,
  Receipt,
  DollarSign,
  CalendarDays,
  Banknote,
  Tag,
  Link2,
  Copy,
  CheckCircle2,
  Percent,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiFetch } from "@/lib/api";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE.replace(/\/$/, "").replace(/\/[^/]+$/, "");
const api = (path: string) => `${API_BASE}/api${path}`;

async function fetchJSON(url: string) {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Erro ao carregar dados");
  return res.json();
}

const TABS = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "planos", label: "Planos", icon: Package },
  { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
  { id: "clinicas", label: "Clínicas", icon: Building2 },
  { id: "pagamentos", label: "Pagamentos", icon: Receipt },
  { id: "cupons", label: "Cupons", icon: Tag },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Tier config ─────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, {
  color: string; bg: string; border: string; gradient: string;
  icon: React.ElementType; badge: string; badgeBg: string;
}> = {
  essencial: {
    color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-200",
    gradient: "from-blue-500 to-blue-600",
    icon: Zap, badge: "text-blue-700", badgeBg: "bg-blue-100",
  },
  profissional: {
    color: "#8b5cf6", bg: "bg-violet-50", border: "border-violet-200",
    gradient: "from-violet-500 to-violet-600",
    icon: Sparkles, badge: "text-violet-700", badgeBg: "bg-violet-100",
  },
  premium: {
    color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200",
    gradient: "from-amber-400 to-amber-500",
    icon: Crown, badge: "text-amber-700", badgeBg: "bg-amber-100",
  },
};

function getTierConfig(name: string) {
  return TIER_CONFIG[name] ?? {
    color: "#6366f1", bg: "bg-indigo-50", border: "border-indigo-200",
    gradient: "from-indigo-500 to-indigo-600",
    icon: Package, badge: "text-indigo-700", badgeBg: "bg-indigo-100",
  };
}

// ─── Status / Payment badges ──────────────────────────────────────────────────

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

type PlanStats = {
  planId: number;
  planName: string;
  planDisplayName: string;
  price: string;
  total: number;
  active: number;
  trial: number;
  suspended: number;
  cancelled: number;
  mrr: number;
};

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

// ─── Plans Tab ────────────────────────────────────────────────────────────────

const EMPTY_PLAN = {
  name: "",
  displayName: "",
  description: "",
  price: "0",
  maxProfessionals: 1 as number | null,
  maxPatients: null as number | null,
  maxSchedules: null as number | null,
  maxUsers: null as number | null,
  trialDays: 30,
  features: [] as string[],
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
  const [view, setView] = useState<"cards" | "table">("cards");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON(api("/plans")),
  });

  const { data: planStats = [] } = useQuery<PlanStats[]>({
    queryKey: ["plans-stats"],
    queryFn: () => fetchJSON(api("/plans/stats")),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(api("/plans/seed-defaults"), { method: "POST" });
      if (!res.ok) throw new Error("Erro ao criar planos padrão");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      const created = data.results.filter((r: any) => r.action === "created").length;
      const skipped = data.results.filter((r: any) => r.action === "skipped").length;
      toast({
        title: "Planos padrão configurados!",
        description: created > 0
          ? `${created} plano(s) criado(s), ${skipped} já existia(m).`
          : "Todos os planos já existiam.",
      });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
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
      const res = await apiFetch(url, {
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
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      toast({ title: editPlan ? "Plano atualizado!" : "Plano criado!" });
      setEditPlan(null);
      setCreating(false);
      setForm(EMPTY_PLAN);
      setFeaturesText("");
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(api(`/plans/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
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

  function getStatsForPlan(planId: number) {
    return planStats.find((s) => s.planId === planId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Planos de Adesão</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie preços, limites e recursos de cada plano</p>
        </div>
        <div className="flex items-center gap-2">
          {plans.length === 0 && (
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="rounded-xl gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Criar Planos Padrão
            </Button>
          )}
          {plans.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="rounded-xl gap-1.5 text-slate-500 text-xs"
              title="Sincronizar planos padrão"
            >
              {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync Padrão
            </Button>
          )}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === "cards" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              onClick={() => setView("cards")}
            >Cards</button>
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === "table" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              onClick={() => setView("table")}
            >Tabela</button>
          </div>
          <Button onClick={openCreate} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Novo Plano
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">Nenhum plano cadastrado</h3>
          <p className="text-sm text-slate-400 mb-6">
            Clique em "Criar Planos Padrão" para gerar os planos Essencial, Profissional e Premium automaticamente.
          </p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="rounded-xl gap-2"
          >
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Criar Planos Padrão
          </Button>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const tier = getTierConfig(plan.name);
            const TierIcon = tier.icon;
            const stats = getStatsForPlan(plan.id);
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 ${tier.border} shadow-sm overflow-hidden flex flex-col`}
              >
                {/* Header */}
                <div className={`bg-gradient-to-br ${tier.gradient} p-5 text-white`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        <TierIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg leading-tight">{plan.displayName}</p>
                        <p className="text-white/70 text-xs">{plan.description}</p>
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${plan.isActive ? "bg-white/20 text-white" : "bg-black/20 text-white/60"}`}>
                      {plan.isActive ? "Ativo" : "Inativo"}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold">{fmtCurrency(plan.price)}</span>
                    <span className="text-white/70 text-sm ml-1">/mês</span>
                  </div>
                  <p className="text-white/60 text-xs mt-0.5">{plan.trialDays} dias de trial grátis</p>
                </div>

                {/* Stats row */}
                {stats && (
                  <div className={`${tier.bg} px-5 py-3 flex items-center justify-between border-b ${tier.border}`}>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-bold text-slate-800">{stats.total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Ativos</p>
                      <p className="text-sm font-bold text-green-700">{stats.active}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Trial</p>
                      <p className="text-sm font-bold text-blue-700">{stats.trial}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">MRR</p>
                      <p className="text-sm font-bold text-slate-800">{fmtCurrency(stats.mrr)}</p>
                    </div>
                  </div>
                )}

                {/* Limits */}
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Limites</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      ["Profissionais", plan.maxProfessionals],
                      ["Pacientes", plan.maxPatients],
                      ["Usuários", plan.maxUsers],
                      ["Agendas", plan.maxSchedules],
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{label as string}</span>
                        <span className="text-xs font-bold text-slate-800">{limitLabel(val as number | null)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 py-3 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recursos</p>
                  <ul className="space-y-1.5">
                    {(plan.features ?? []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: tier.color }} />
                        <span className="text-xs text-slate-600">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs gap-1.5" onClick={() => openEdit(plan)}>
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => setDeleteId(plan.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
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
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Usuários</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trial</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Assinantes</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const tier = getTierConfig(plan.name);
                const TierIcon = tier.icon;
                const stats = getStatsForPlan(plan.id);
                return (
                  <TableRow key={plan.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tier.color + "18" }}>
                          <TierIcon className="w-4 h-4" style={{ color: tier.color }} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{plan.displayName}</p>
                          <p className="text-xs text-slate-400">{plan.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(plan.price)}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxProfessionals)}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxPatients)}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{limitLabel(plan.maxUsers)}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{plan.trialDays}d</TableCell>
                    <TableCell className="text-center">
                      {stats ? (
                        <span className="text-sm font-bold text-slate-700">{stats.total}</span>
                      ) : "—"}
                    </TableCell>
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
                );
              })}
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

type ClinicBasic = { id: number; name: string; email: string | null; isActive: boolean; createdAt: string };

function SubscriptionsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editSub, setEditSub] = useState<SubRow | null>(null);
  const [subForm, setSubForm] = useState({
    status: "trial",
    planId: "",
    paymentStatus: "pending",
    amount: "",
    trialEndDate: "",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [newSubForm, setNewSubForm] = useState({
    clinicId: "",
    planId: "",
    status: "trial",
    paymentStatus: "pending",
    amount: "",
  });

  const { data: allClinics = [] } = useQuery<ClinicBasic[]>({
    queryKey: ["all-clinics"],
    queryFn: () => fetchJSON(api("/clinics")),
  });

  const { data: subs = [], isLoading } = useQuery<SubRow[]>({
    queryKey: ["clinic-subscriptions"],
    queryFn: () => fetchJSON(api("/clinic-subscriptions")),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJSON(api("/plans")),
  });

  // Clinics that already have a subscription
  const subsClinicIds = useMemo(() => new Set(subs.map((s) => s.sub.clinicId)), [subs]);
  const clinicsWithoutSub = useMemo(() => allClinics.filter((c) => !subsClinicIds.has(c.id)), [allClinics, subsClinicIds]);

  const createSubMutation = useMutation({
    mutationFn: async () => {
      if (!newSubForm.clinicId || !newSubForm.planId) throw new Error("Selecione clínica e plano");
      const selectedPlan = plans.find((p) => String(p.id) === newSubForm.planId);
      const payload = {
        clinicId: Number(newSubForm.clinicId),
        planId: Number(newSubForm.planId),
        status: newSubForm.status,
        paymentStatus: newSubForm.paymentStatus,
        amount: newSubForm.amount ? Number(newSubForm.amount) : selectedPlan ? Number(selectedPlan.price) : undefined,
      };
      const res = await apiFetch(api("/clinic-subscriptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Erro ao criar assinatura");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      toast({ title: "Assinatura criada com sucesso!" });
      setNewSubOpen(false);
      setNewSubForm({ clinicId: "", planId: "", status: "trial", paymentStatus: "pending", amount: "" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
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
      const res = await apiFetch(api(`/clinic-subscriptions/${editSub.sub.id}`), {
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
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      toast({ title: "Assinatura atualizada!" });
      setEditSub(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: object }) => {
      const res = await apiFetch(api(`/clinic-subscriptions/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      toast({ title: "Assinatura atualizada!" });
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

  const filtered = useMemo(() => {
    return subs.filter((row) => {
      const nameMatch = !search || (row.clinic?.name ?? "").toLowerCase().includes(search.toLowerCase()) || (row.clinic?.email ?? "").toLowerCase().includes(search.toLowerCase());
      const statusMatch = filterStatus === "all" || row.sub.status === filterStatus;
      const planMatch = filterPlan === "all" || String(row.sub.planId) === filterPlan;
      return nameMatch && statusMatch && planMatch;
    });
  }, [subs, search, filterStatus, filterPlan]);

  const trialExpiringSoon = subs.filter((row) => {
    if (row.sub.status !== "trial" || !row.sub.trialEndDate) return false;
    try {
      const days = differenceInDays(parseISO(row.sub.trialEndDate), new Date());
      return days >= 0 && days <= 7;
    } catch { return false; }
  });

  // auto-fill amount when plan changes in new sub form
  const handleNewSubPlanChange = (planId: string) => {
    const plan = plans.find((p) => String(p.id) === planId);
    setNewSubForm((f) => ({ ...f, planId, amount: plan ? plan.price : "" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Assinaturas das Clínicas</h2>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe e gerencie o status de cada clínica</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{subs.length}</p>
            <p className="text-xs text-slate-400">com assinatura</p>
          </div>
          <Button onClick={() => setNewSubOpen(true)} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Nova Assinatura
          </Button>
        </div>
      </div>

      {/* Clinics without subscription alert */}
      {clinicsWithoutSub.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-800">
                {clinicsWithoutSub.length} clínica(s) sem plano vinculado
              </p>
              <p className="text-xs text-indigo-600 mt-0.5 mb-2">
                {clinicsWithoutSub.map((c) => c.name).join(", ")}
              </p>
              <div className="flex flex-wrap gap-2">
                {clinicsWithoutSub.map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => {
                      const defaultPlan = plans[0];
                      setNewSubForm({
                        clinicId: String(clinic.id),
                        planId: defaultPlan ? String(defaultPlan.id) : "",
                        status: "trial",
                        paymentStatus: "pending",
                        amount: defaultPlan ? defaultPlan.price : "",
                      });
                      setNewSubOpen(true);
                    }}
                    className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    {clinic.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trial expiring soon alert */}
      {trialExpiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {trialExpiringSoon.length} trial(s) expirando nos próximos 7 dias
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {trialExpiringSoon.map((r) => r.clinic?.name ?? "—").join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por clínica ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="rounded-xl w-40">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="suspended">Suspenso</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="rounded-xl w-44">
            <Package className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {plans.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterPlan !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPlan("all"); }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {subs.length === 0 ? "Nenhuma assinatura encontrada" : "Nenhum resultado para os filtros aplicados"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {subs.length === 0 ? "Assinaturas são criadas automaticamente ao cadastrar uma clínica" : "Tente mudar os filtros de busca"}
          </p>
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
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const tier = getTierConfig(row.plan?.name ?? "");
                const TierIcon = tier.icon;
                const trialDaysLeft = row.sub.trialEndDate
                  ? differenceInDays(parseISO(row.sub.trialEndDate), new Date())
                  : null;
                return (
                  <TableRow key={row.sub.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{row.clinic?.name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{row.clinic?.email ?? ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.plan ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: tier.color + "18" }}>
                            <TierIcon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{row.plan.displayName}</span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.sub.status} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-slate-600">{fmtDate(row.sub.trialEndDate)}</p>
                        {trialDaysLeft !== null && row.sub.status === "trial" && (
                          <p className={`text-xs font-semibold ${trialDaysLeft <= 3 ? "text-red-500" : trialDaysLeft <= 7 ? "text-amber-500" : "text-slate-400"}`}>
                            {trialDaysLeft < 0 ? "Expirado" : `${trialDaysLeft}d restantes`}
                          </p>
                        )}
                      </div>
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
                      <div className="flex items-center gap-1 justify-center">
                        {row.sub.status === "trial" && (
                          <button
                            onClick={() => quickUpdateMutation.mutate({ id: row.sub.id, payload: { status: "active", paymentStatus: "paid" } })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            title="Ativar assinatura"
                          >
                            Ativar
                          </button>
                        )}
                        {row.sub.status === "active" && row.sub.paymentStatus !== "paid" && (
                          <button
                            onClick={() => quickUpdateMutation.mutate({ id: row.sub.id, payload: { paymentStatus: "paid" } })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            title="Marcar como pago"
                          >
                            Pago
                          </button>
                        )}
                        {(row.sub.status === "active" || row.sub.status === "trial") && (
                          <button
                            onClick={() => quickUpdateMutation.mutate({ id: row.sub.id, payload: { status: "suspended" } })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                            title="Suspender"
                          >
                            Suspender
                          </button>
                        )}
                        {row.sub.status === "suspended" && (
                          <button
                            onClick={() => quickUpdateMutation.mutate({ id: row.sub.id, payload: { status: "active" } })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            Reativar
                          </button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(row)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length < subs.length && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">
                Mostrando {filtered.length} de {subs.length} assinaturas
              </p>
            </div>
          )}
        </div>
      )}

      {/* New subscription dialog */}
      <Dialog open={newSubOpen} onOpenChange={(o) => { if (!o) setNewSubOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Assinatura</DialogTitle>
            <DialogDescription>Vincule um plano a uma clínica manualmente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Clínica</Label>
              <Select value={newSubForm.clinicId} onValueChange={(v) => setNewSubForm((f) => ({ ...f, clinicId: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a clínica" />
                </SelectTrigger>
                <SelectContent>
                  {allClinics.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        {!subsClinicIds.has(c.id) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Sem plano</span>
                        )}
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={newSubForm.planId} onValueChange={handleNewSubPlanChange}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => {
                    const tier = getTierConfig(p.name);
                    const TierIcon = tier.icon;
                    return (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <div className="flex items-center gap-2">
                          <TierIcon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                          {p.displayName} — {fmtCurrency(p.price)}/mês
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={newSubForm.status} onValueChange={(v) => setNewSubForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pagamento</Label>
                <Select value={newSubForm.paymentStatus} onValueChange={(v) => setNewSubForm((f) => ({ ...f, paymentStatus: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="free">Grátis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Valor cobrado (R$)</Label>
              <Input
                type="number" min={0} step={0.01}
                value={newSubForm.amount}
                onChange={(e) => setNewSubForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="Preenchido automaticamente pelo plano"
                className="rounded-xl"
              />
            </div>

            {newSubForm.planId && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                {(() => {
                  const plan = plans.find((p) => String(p.id) === newSubForm.planId);
                  if (!plan) return null;
                  return (
                    <span>
                      Trial de <strong>{plan.trialDays} dias</strong> será iniciado hoje.
                      O plano <strong>{plan.displayName}</strong> custa {fmtCurrency(plan.price)}/mês após o período de trial.
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSubOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createSubMutation.mutate()}
              disabled={createSubMutation.isPending || !newSubForm.clinicId || !newSubForm.planId}
            >
              {createSubMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Criar Assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit subscription dialog */}
      <Dialog open={editSub !== null} onOpenChange={(o) => { if (!o) setEditSub(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  {plans.map((p) => {
                    const tier = getTierConfig(p.name);
                    const TierIcon = tier.icon;
                    return (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <div className="flex items-center gap-2">
                          <TierIcon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                          {p.displayName} — {fmtCurrency(p.price)}/mês
                        </div>
                      </SelectItem>
                    );
                  })}
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
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: subs = [], isLoading: subsLoading } = useQuery<SubRow[]>({
    queryKey: ["clinic-subscriptions"],
    queryFn: () => fetchJSON(api("/clinic-subscriptions")),
  });

  const { data: planStats = [], isLoading: statsLoading } = useQuery<PlanStats[]>({
    queryKey: ["plans-stats"],
    queryFn: () => fetchJSON(api("/plans/stats")),
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(api("/clinic-subscriptions/run-check"), { method: "POST" });
      if (!res.ok) throw new Error("Falha na verificação");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["plans-stats"] });
      toast({
        title: "Verificação concluída",
        description: `${data.trialsExpired} trials expirados, ${data.renewed ?? 0} períodos renovados, ${data.markedOverdue} inadimplentes, ${data.suspended} suspensas.`,
      });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const isLoading = subsLoading || statsLoading;

  const total = subs.length;
  const trial = subs.filter((s) => s.sub.status === "trial").length;
  const active = subs.filter((s) => s.sub.status === "active").length;
  const suspended = subs.filter((s) => s.sub.status === "suspended" || s.sub.status === "cancelled").length;
  const overdue = subs.filter((s) => s.sub.paymentStatus === "overdue").length;
  const mrr = subs
    .filter((s) => s.sub.status === "active" && s.sub.paymentStatus === "paid")
    .reduce((acc, s) => acc + Number(s.sub.amount ?? 0), 0);

  const recentTrialExpiring = subs
    .filter((row) => {
      if (row.sub.status !== "trial" || !row.sub.trialEndDate) return false;
      try {
        const days = differenceInDays(parseISO(row.sub.trialEndDate), new Date());
        return days >= 0 && days <= 14;
      } catch { return false; }
    })
    .sort((a, b) => {
      try {
        return differenceInDays(parseISO(a.sub.trialEndDate!), new Date()) - differenceInDays(parseISO(b.sub.trialEndDate!), new Date());
      } catch { return 0; }
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Painel Geral</h2>
          <p className="text-sm text-slate-500 mt-0.5">Visão consolidada das clínicas e assinaturas</p>
        </div>
        <Button
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending}
          variant="outline"
          size="sm"
          className="rounded-xl gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        >
          {checkMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Verificar Assinaturas
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total de Clínicas" value={total} icon={Building2} color="#6366f1" />
        <KpiCard label="Em Trial" value={trial} sub="período gratuito" icon={Clock} color="#0ea5e9" />
        <KpiCard label="Assinaturas Ativas" value={active} icon={CheckCircle} color="#10b981" />
        <KpiCard label="Suspensas / Canceladas" value={suspended} icon={XCircle} color="#ef4444" />
        <KpiCard label="Inadimplentes" value={overdue} icon={AlertTriangle} color="#f59e0b" />
        <KpiCard label="MRR (estimado)" value={fmtCurrency(mrr)} sub="mensalidades pagas ativas" icon={TrendingUp} color="#8b5cf6" />
      </div>

      {/* Per-plan breakdown */}
      {planStats.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Distribuição por Plano
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planStats.map((stat) => {
              const tier = getTierConfig(stat.planName);
              const TierIcon = tier.icon;
              return (
                <div key={stat.planId} className={`bg-white rounded-2xl border-2 ${tier.border} p-5 space-y-4`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: tier.color + "18" }}>
                      <TierIcon className="w-5 h-5" style={{ color: tier.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{stat.planDisplayName}</p>
                      <p className="text-xs text-slate-400">{fmtCurrency(stat.price)}/mês</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 ${tier.bg}`}>
                      <p className="text-xs text-slate-500 mb-0.5">Total</p>
                      <p className="text-xl font-extrabold" style={{ color: tier.color }}>{stat.total}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-green-50">
                      <p className="text-xs text-slate-500 mb-0.5">Ativos</p>
                      <p className="text-xl font-extrabold text-green-700">{stat.active}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-blue-50">
                      <p className="text-xs text-slate-500 mb-0.5">Trial</p>
                      <p className="text-xl font-extrabold text-blue-700">{stat.trial}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-0.5">MRR</p>
                      <p className="text-sm font-extrabold text-slate-800">{fmtCurrency(stat.mrr)}</p>
                    </div>
                  </div>

                  {stat.total > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Conversão Trial → Ativo</span>
                        <span>{stat.total > 0 ? Math.round((stat.active / stat.total) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${stat.total > 0 ? Math.round((stat.active / stat.total) * 100) : 0}%`,
                            backgroundColor: tier.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trials expiring soon */}
      {recentTrialExpiring.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Trials expirando em breve
          </h3>
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50/60 border-b border-amber-100">
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clínica</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trial expira</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Dias restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrialExpiring.map((row) => {
                  const daysLeft = row.sub.trialEndDate
                    ? differenceInDays(parseISO(row.sub.trialEndDate), new Date())
                    : null;
                  return (
                    <TableRow key={row.sub.id} className="border-b border-amber-50 hover:bg-amber-50/40">
                      <TableCell className="font-medium text-sm text-slate-800">{row.clinic?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.plan?.displayName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{fmtDate(row.sub.trialEndDate)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft !== null && daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {daysLeft !== null ? `${daysLeft}d` : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Recent subscriptions */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          Assinaturas recentes
        </h3>
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
              {subs.slice(0, 8).map((row) => (
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

// ─── Clinics Tab ──────────────────────────────────────────────────────────────

type ClinicRow = {
  clinic: { id: number; name: string; email: string | null; phone: string | null; cnpj: string | null; isActive: boolean; createdAt: string };
  sub: { id: number; status: string; paymentStatus: string; trialEndDate: string | null; currentPeriodEnd: string | null; amount: string | null } | null;
  plan: { id: number; name: string; displayName: string; price: string } | null;
};

function ClinicsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [checkResult, setCheckResult] = useState<null | {
    trialsExpired: number; renewed: number; markedOverdue: number; suspended: number; errors: number;
  }>(null);

  const { data: rows = [], isLoading } = useQuery<ClinicRow[]>({
    queryKey: ["admin-clinics"],
    queryFn: () => fetchJSON(api("/admin/clinics")),
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(api("/clinic-subscriptions/run-check"), { method: "POST" });
      if (!res.ok) throw new Error("Falha na verificação");
      return res.json();
    },
    onSuccess: (data) => {
      setCheckResult(data);
      qc.invalidateQueries({ queryKey: ["admin-clinics"] });
      qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
      toast({
        title: "Verificação concluída",
        description: `${data.trialsExpired} trials expirados, ${data.renewed ?? 0} períodos renovados, ${data.markedOverdue} inadimplentes, ${data.suspended} suspensas.`,
      });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.clinic.name.toLowerCase().includes(s) ||
        (r.clinic.email ?? "").toLowerCase().includes(s) ||
        (r.clinic.cnpj ?? "").includes(s)
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Clínicas Cadastradas</h2>
          <p className="text-sm text-slate-500 mt-0.5">Todas as clínicas e seus planos ativos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clínica..."
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
          </div>
          <Button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            variant="outline"
            className="rounded-xl gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            {checkMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Verificar Assinaturas
          </Button>
        </div>
      </div>

      {checkResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-6 text-sm flex-wrap">
          <span className="font-semibold text-indigo-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-indigo-600" />
            Último resultado da verificação:
          </span>
          <span className="text-slate-700">{checkResult.trialsExpired} trials expirados</span>
          <span className="text-green-700">{checkResult.renewed} períodos renovados</span>
          <span className="text-amber-700">{checkResult.markedOverdue} inadimplentes</span>
          <span className="text-red-700">{checkResult.suspended} suspensas</span>
          {checkResult.errors > 0 && <span className="text-red-600 font-semibold">{checkResult.errors} erros</span>}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {rows.length === 0 ? "Nenhuma clínica cadastrada" : "Nenhum resultado"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clínica</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plano</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Pagamento</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Mensalidade</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const tier = row.plan ? getTierConfig(row.plan.name) : getTierConfig("");
                const TierIcon = tier.icon;
                const trialExpiring = row.sub?.status === "trial" && row.sub.trialEndDate
                  ? differenceInDays(parseISO(row.sub.trialEndDate), new Date())
                  : null;
                return (
                  <TableRow
                    key={row.clinic.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/60 ${
                      row.sub?.status === "suspended" || row.sub?.status === "cancelled" ? "bg-red-50/30" :
                      row.sub?.paymentStatus === "overdue" ? "bg-amber-50/30" : ""
                    }`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{row.clinic.name}</p>
                        <p className="text-xs text-slate-400">{row.clinic.email ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 tabular-nums">{row.clinic.cnpj ?? "—"}</TableCell>
                    <TableCell>
                      {row.plan ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: tier.color + "18" }}>
                            <TierIcon className="w-3.5 h-3.5" style={{ color: tier.color }} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{row.plan.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.sub ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <StatusBadge status={row.sub.status} />
                          {trialExpiring !== null && trialExpiring <= 7 && (
                            <span className={`text-[10px] font-bold ${trialExpiring <= 3 ? "text-red-500" : "text-amber-500"}`}>
                              {trialExpiring < 0 ? "Expirado" : `${trialExpiring}d`}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.sub ? <PaymentBadge status={row.sub.paymentStatus} /> : <span className="text-slate-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-slate-700 text-sm">
                      {row.sub?.amount ? fmtCurrency(row.sub.amount) : row.plan ? fmtCurrency(row.plan.price) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {row.sub?.status === "trial" ? fmtDate(row.sub.trialEndDate) : fmtDate(row.sub?.currentPeriodEnd)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${row.clinic.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {row.clinic.isActive ? "✓" : "✗"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              {filtered.length} de {rows.length} clínicas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  manual: "Manual",
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  boleto: "Boleto",
  transfer: "Transferência",
  other: "Outro",
};

type PaymentRow = {
  payment: {
    id: number;
    clinicId: number;
    subscriptionId: number | null;
    amount: string;
    method: string;
    referenceMonth: string | null;
    paidAt: string;
    notes: string | null;
    recordedBy: number | null;
    createdAt: string;
  };
  clinic: { id: number; name: string; email: string } | null;
  recorder: { id: number; name: string } | null;
  plan: { id: number; displayName: string } | null;
};

type PaymentStats = {
  totalAllTime: number;
  totalThisMonth: number;
  totalPayments: number;
  referenceMonth: string;
};

function PaymentsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<PaymentRow[]>({
    queryKey: ["payment-history"],
    queryFn: () => fetchJSON(api("/payment-history")),
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PaymentStats>({
    queryKey: ["payment-history-stats"],
    queryFn: () => fetchJSON(api("/payment-history/stats")),
  });

  const { data: subs = [] } = useQuery<SubRow[]>({
    queryKey: ["clinic-subscriptions"],
    queryFn: () => fetchJSON(api("/clinic-subscriptions")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(api(`/payment-history/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao remover pagamento");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-history"] });
      qc.invalidateQueries({ queryKey: ["payment-history-stats"] });
      toast({ title: "Pagamento removido" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (r) =>
        r.clinic?.name?.toLowerCase().includes(q) ||
        r.clinic?.email?.toLowerCase().includes(q) ||
        r.payment.referenceMonth?.includes(q) ||
        r.payment.method?.includes(q)
    );
  }, [payments, search]);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (d: string) =>
    format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });

  const fmtMonth = (m: string | null) => {
    if (!m) return "—";
    const [year, month] = m.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Histórico de Pagamentos</h2>
          <p className="text-sm text-slate-500 mt-0.5">Todos os pagamentos recebidos das clínicas</p>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          size="sm"
          className="rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar Pagamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))
        ) : (
          <>
            <KpiCard
              label="Recebido Este Mês"
              value={fmtBRL(stats?.totalThisMonth ?? 0)}
              icon={DollarSign}
              color="#10b981"
            />
            <KpiCard
              label="Total Histórico"
              value={fmtBRL(stats?.totalAllTime ?? 0)}
              icon={TrendingUp}
              color="#6366f1"
            />
            <KpiCard
              label="Pagamentos Registrados"
              value={stats?.totalPayments ?? 0}
              icon={Receipt}
              color="#0ea5e9"
            />
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por clínica, método ou mês..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-slate-200"
        />
      </div>

      {/* Table */}
      {paymentsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">Nenhum pagamento registrado</p>
          <p className="text-sm mt-1">Clique em "Registrar Pagamento" para começar.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Clínica</TableHead>
                <TableHead className="font-semibold text-slate-700">Plano</TableHead>
                <TableHead className="font-semibold text-slate-700">Mês Ref.</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Valor</TableHead>
                <TableHead className="font-semibold text-slate-700">Método</TableHead>
                <TableHead className="font-semibold text-slate-700">Data Pagamento</TableHead>
                <TableHead className="font-semibold text-slate-700">Registrado por</TableHead>
                <TableHead className="font-semibold text-slate-700">Obs.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.payment.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{row.clinic?.name ?? `#${row.payment.clinicId}`}</p>
                      <p className="text-xs text-slate-400">{row.clinic?.email ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{row.plan?.displayName ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{fmtMonth(row.payment.referenceMonth)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-emerald-700 text-sm">
                      {fmtBRL(Number(row.payment.amount))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {PAYMENT_METHOD_LABELS[row.payment.method] ?? row.payment.method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{fmtDate(row.payment.paidAt)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-500">{row.recorder?.name ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-400 max-w-[120px] truncate block" title={row.payment.notes ?? ""}>
                      {row.payment.notes || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg h-7 w-7 p-0"
                      onClick={() => setDeleteId(row.payment.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              {filtered.length} de {payments.length} pagamentos
            </p>
          </div>
        </div>
      )}

      {/* Register Payment Dialog */}
      <RegisterPaymentDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        subs={subs}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["payment-history"] });
          qc.invalidateQueries({ queryKey: ["payment-history-stats"] });
          qc.invalidateQueries({ queryKey: ["clinic-subscriptions"] });
        }}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Este registro será removido permanentemente do histórico de pagamentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Register Payment Dialog ───────────────────────────────────────────────────

function RegisterPaymentDialog({
  open,
  onClose,
  subs,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  subs: SubRow[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [clinicId, setClinicId] = useState<string>("");
  const [subscriptionId, setSubscriptionId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("pix");
  const [referenceMonth, setReferenceMonth] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<boolean>(true);

  const clinicSub = subs.find((s) => String(s.sub.clinicId) === clinicId);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        clinicId: Number(clinicId),
        amount: Number(amount),
        method,
        updateSubscriptionStatus: updateStatus,
      };
      if (subscriptionId) body.subscriptionId = Number(subscriptionId);
      if (referenceMonth) body.referenceMonth = referenceMonth;
      if (paidAt) body.paidAt = new Date(paidAt).toISOString();
      if (notes.trim()) body.notes = notes.trim();

      const res = await apiFetch(api("/payment-history"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Falha ao registrar pagamento");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pagamento registrado com sucesso" });
      onSuccess();
      onClose();
      setClinicId("");
      setSubscriptionId("");
      setAmount("");
      setMethod("pix");
      setReferenceMonth("");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNotes("");
      setUpdateStatus(true);
    },
    onError: (err: any) =>
      toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const canSubmit = clinicId && amount && Number(amount) > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-indigo-600" />
            Registrar Pagamento
          </DialogTitle>
          <DialogDescription>
            Registre um pagamento recebido de uma clínica manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Clinic */}
          <div className="space-y-1.5">
            <Label>Clínica *</Label>
            <Select value={clinicId} onValueChange={(v) => { setClinicId(v); setSubscriptionId(""); }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione a clínica" />
              </SelectTrigger>
              <SelectContent>
                {subs.map((s) => (
                  <SelectItem key={s.sub.clinicId} value={String(s.sub.clinicId)}>
                    {s.clinic?.name ?? "(sem nome)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subscription (auto-filled) */}
          {clinicSub && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                Plano <strong>{clinicSub.plan?.displayName ?? "—"}</strong> — {clinicSub.sub.status}
              </span>
            </div>
          )}

          {/* Amount + Method row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference month + paid at row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês de referência</Label>
              <Input
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Número de comprovante, observações..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl resize-none"
            />
          </div>

          {/* Update subscription status toggle */}
          {clinicSub && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-700">Atualizar status da assinatura</p>
                <p className="text-xs text-slate-400">Marca a assinatura como "Pago" automaticamente</p>
              </div>
              <Switch checked={updateStatus} onCheckedChange={setUpdateStatus} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Registrar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coupons Tab ─────────────────────────────────────────────────────────────

type CouponRow = {
  id: number;
  code: string;
  description: string;
  type: "discount" | "referral";
  discountType: "percent" | "fixed";
  discountValue: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  minPlanAmount: string | null;
  applicablePlanNames: string[] | null;
  referrerClinicId: number | null;
  referrerBenefitType: string | null;
  referrerBenefitValue: string | null;
  notes: string | null;
  createdAt: string;
};

const EMPTY_COUPON = {
  code: "",
  description: "",
  type: "discount" as "discount" | "referral",
  discountType: "percent" as "percent" | "fixed",
  discountValue: "30",
  maxUses: "" as string,
  expiresAt: "",
  isActive: true,
  minPlanAmount: "",
  applicablePlanNames: [] as string[],
  referrerClinicId: "" as string,
  referrerBenefitType: "" as "percent" | "fixed" | "",
  referrerBenefitValue: "" as string,
  notes: "",
};

function CouponsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CouponRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_COUPON });
  const [copying, setCopying] = useState<number | null>(null);
  const [clinicComboOpen, setClinicComboOpen] = useState(false);

  const { data: coupons = [], isLoading } = useQuery<CouponRow[]>({
    queryKey: ["coupon-codes"],
    queryFn: () => fetchJSON(api("/coupon-codes")),
  });

  const { data: activeClinics = [] } = useQuery<ClinicBasic[]>({
    queryKey: ["all-clinics"],
    queryFn: () => fetchJSON(api("/clinics")),
    select: (data) => data.filter((c) => c.isActive),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [coupons, search]);

  const stats = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter((c) => c.isActive).length,
    totalUses: coupons.reduce((sum, c) => sum + (c.usedCount ?? 0), 0),
    referrals: coupons.filter((c) => c.type === "referral").length,
  }), [coupons]);

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_COUPON });
    setDialogOpen(true);
  }

  function openEdit(c: CouponRow) {
    setEditTarget(c);
    setForm({
      code: c.code,
      description: c.description,
      type: c.type,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      isActive: c.isActive,
      minPlanAmount: c.minPlanAmount ?? "",
      applicablePlanNames: c.applicablePlanNames ?? [],
      referrerClinicId: c.referrerClinicId != null ? String(c.referrerClinicId) : "",
      referrerBenefitType: (c.referrerBenefitType as "percent" | "fixed" | "") ?? "",
      referrerBenefitValue: c.referrerBenefitValue ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase().trim(),
        description: form.description,
        type: form.type,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
        minPlanAmount: form.minPlanAmount ? Number(form.minPlanAmount) : null,
        applicablePlanNames: form.applicablePlanNames.length > 0 ? form.applicablePlanNames : null,
        referrerClinicId: form.referrerClinicId ? Number(form.referrerClinicId) : null,
        referrerBenefitType: form.referrerBenefitType || null,
        referrerBenefitValue: form.referrerBenefitValue ? Number(form.referrerBenefitValue) : null,
        notes: form.notes || null,
      };
      const url = editTarget ? api(`/coupon-codes/${editTarget.id}`) : api("/coupon-codes");
      const method = editTarget ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupon-codes"] });
      setDialogOpen(false);
      toast({ title: editTarget ? "Cupom atualizado!" : "Cupom criado!" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(api(`/coupon-codes/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["coupon-codes"] });
      setDeleteTarget(null);
      toast({ title: data.message ?? "Cupom removido." });
    },
    onError: () => toast({ title: "Erro ao remover cupom", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiFetch(api(`/coupon-codes/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupon-codes"] }),
    onError: () => toast({ title: "Erro ao atualizar cupom", variant: "destructive" }),
  });

  function getCouponLink(code: string) {
    return `${window.location.origin}/register?cupom=${encodeURIComponent(code)}`;
  }

  async function copyLink(coupon: CouponRow) {
    setCopying(coupon.id);
    try {
      await navigator.clipboard.writeText(getCouponLink(coupon.code));
      toast({ title: "Link copiado!", description: getCouponLink(coupon.code) });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
    setTimeout(() => setCopying(null), 1500);
  }

  function discountLabel(c: CouponRow) {
    if (c.discountType === "percent") return `${Number(c.discountValue).toFixed(0)}%`;
    return `R$ ${Number(c.discountValue).toFixed(2).replace(".", ",")}`;
  }

  const PLAN_OPTIONS = ["essencial", "profissional", "premium"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cupons</h2>
            <p className="text-sm text-slate-500 mt-0.5">Cupons de desconto e indicação</p>
          </div>
        </div>
        <Button onClick={openCreate} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Novo Cupom
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total de Cupons", value: stats.total, icon: Tag, color: "#8b5cf6" },
          { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "#10b981" },
          { label: "Usos Totais", value: stats.totalUses, icon: Hash, color: "#0ea5e9" },
          { label: "Indicações", value: stats.referrals, icon: Link2, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: s.color }} />
            <div className="flex items-center gap-3 pl-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: s.color + "18" }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por código ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-white border-slate-200"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 border-b border-slate-100">
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desconto</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usos</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validade</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Nenhum cupom encontrado</p>
                    <p className="text-xs text-slate-400">Crie o primeiro cupom clicando em "Novo Cupom"</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <TableCell>
                    <div>
                      <span className="font-mono font-bold text-slate-900 tracking-widest">{c.code}</span>
                      {c.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{c.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.type === "referral"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-violet-50 text-violet-700"
                    }`}>
                      {c.type === "referral" ? <Link2 className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                      {c.type === "referral" ? "Indicação" : "Desconto"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-emerald-600 tabular-nums text-sm">
                      {c.discountType === "percent" ? <Percent className="w-3 h-3 inline mr-0.5" /> : null}
                      {discountLabel(c)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums text-sm text-slate-700">
                      {c.usedCount ?? 0}
                      {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.expiresAt ? (
                      <span className={`text-xs ${new Date(c.expiresAt) < new Date() ? "text-red-500 font-semibold" : "text-slate-500"}`}>
                        {format(parseISO(c.expiresAt), "dd/MM/yyyy")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem validade</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, isActive: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyLink(c)}
                        title="Copiar link de indicação"
                        className="p-1.5 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
                      >
                        {copying === c.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Altere os dados do cupom." : "Preencha os dados do novo cupom."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código *</Label>
                <Input
                  placeholder="Ex: FISIO30"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, "") })}
                  className="rounded-xl font-mono tracking-widest uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v: "discount" | "referral") => setForm({ ...form, type: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Desconto</SelectItem>
                    <SelectItem value="referral">Indicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: 30% de desconto para novos usuários"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Desconto *</Label>
                <Select value={form.discountType} onValueChange={(v: "percent" | "fixed") => setForm({ ...form, discountType: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor do Desconto *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    {form.discountType === "percent" ? "%" : "R$"}
                  </span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="rounded-xl pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Limite de Usos</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Sem limite"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Planos aplicáveis</Label>
              <div className="flex gap-2 flex-wrap">
                {PLAN_OPTIONS.map((p) => {
                  const selected = form.applicablePlanNames.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          applicablePlanNames: selected
                            ? form.applicablePlanNames.filter((x) => x !== p)
                            : [...form.applicablePlanNames, p],
                        });
                      }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all capitalize ${
                        selected
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-500 bg-white hover:border-slate-300"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 inline mr-1" />}
                      {p}
                    </button>
                  );
                })}
                <p className="text-xs text-slate-400 w-full">Deixe vazio para todos os planos</p>
              </div>
            </div>

            {form.type === "referral" && (
              <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Benefício para quem indica
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo do benefício</Label>
                    <Select
                      value={form.referrerBenefitType}
                      onValueChange={(v) => setForm({ ...form, referrerBenefitType: v as "percent" | "fixed" | "" })}
                    >
                      <SelectTrigger className="rounded-xl bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentual (%)</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor do benefício</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 20"
                      value={form.referrerBenefitValue}
                      onChange={(e) => setForm({ ...form, referrerBenefitValue: e.target.value })}
                      className="rounded-xl bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Clínica indicadora</Label>
                  <Popover open={clinicComboOpen} onOpenChange={setClinicComboOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm ring-offset-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <span className={form.referrerClinicId ? "text-foreground" : "text-muted-foreground"}>
                          {form.referrerClinicId
                            ? (activeClinics.find((c) => String(c.id) === form.referrerClinicId)?.name ?? `ID ${form.referrerClinicId}`)
                            : "Selecione uma clínica..."}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar clínica..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma clínica encontrada.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                setForm({ ...form, referrerClinicId: "" });
                                setClinicComboOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${!form.referrerClinicId ? "opacity-100" : "opacity-0"}`} />
                              <span className="text-muted-foreground italic">Nenhuma</span>
                            </CommandItem>
                            {activeClinics.map((clinic) => (
                              <CommandItem
                                key={clinic.id}
                                value={`${clinic.name} ${clinic.id}`}
                                onSelect={() => {
                                  setForm({ ...form, referrerClinicId: String(clinic.id) });
                                  setClinicComboOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${form.referrerClinicId === String(clinic.id) ? "opacity-100" : "opacity-0"}`} />
                                <span>{clinic.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">#{clinic.id}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observações internas</Label>
              <Input
                placeholder="Notas internas sobre este cupom"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                id="coupon-active"
              />
              <Label htmlFor="coupon-active" className="cursor-pointer">
                Cupom ativo
              </Label>
            </div>

            {form.code && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Link de indicação
                </p>
                <p className="text-xs text-slate-600 font-mono break-all">
                  {window.location.origin}/register?cupom={form.code}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.code || !form.discountValue}
              className="rounded-xl"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? "Salvar" : "Criar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Cupom</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o cupom{" "}
              <strong className="font-mono">{deleteTarget?.code}</strong>?
              {(deleteTarget?.usedCount ?? 0) > 0 && (
                <span className="block text-amber-600 mt-1">
                  Este cupom tem {deleteTarget?.usedCount} uso(s) registrado(s) e será desativado em vez de excluído.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>("painel");

  return (
    <AppLayout title="Painel SuperAdmin">
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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap">
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
        {activeTab === "clinicas" && <ClinicsTab />}
        {activeTab === "pagamentos" && <PaymentsTab />}
        {activeTab === "cupons" && <CouponsTab />}
      </div>
    </AppLayout>
  );
}
