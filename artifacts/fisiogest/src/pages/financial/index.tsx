import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetFinancialDashboard,
  useListFinancialRecords,
  useCreateFinancialRecord,
  useListProcedures,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Loader2,
  Ticket, Stethoscope, CalendarDays, Link2, Trash2,
  RefreshCw, CalendarCheck2, AlertTriangle, Repeat, Clock,
  BarChart3, Target, Receipt, Settings2, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Edit2,
  PiggyBank, Activity, AlertCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const GENERAL_EXPENSE_CATEGORIES = [
  "Aluguel", "Água e Luz", "Internet", "Telefone",
  "Material de Escritório", "Equipamentos", "Marketing",
  "Salários", "Pró-labore", "Impostos e Taxas", "Contabilidade",
  "Manutenção", "Seguro", "Outros",
];

const PROCEDURE_EXPENSE_CATEGORIES = [
  "Insumos e Materiais", "Consumíveis", "Produtos Cosméticos",
  "Medicamentos", "Luvas e EPI", "Material Descartável",
  "Equipamento de Procedimento", "Outros",
];

const REVENUE_CATEGORIES = [
  "Consulta", "Avaliação", "Procedimento", "Pacote de Sessões",
  "Pilates", "Estética", "Outros",
];

const RECURRING_CATEGORIES = [
  "Aluguel", "Água e Luz", "Internet", "Telefone",
  "Salários", "Pró-labore", "Impostos e Taxas", "Contabilidade",
  "Marketing", "Equipamentos", "Manutenção", "Seguro", "Outros",
];

const FREQUENCY_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual (÷12)" },
  { value: "semanal", label: "Semanal (×4,33)" },
];

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#14b8a6", "#f97316"];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - i);

// ─── Auth helper ──────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("fisiogest_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ─── KPI Card (Redesigned) ────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, accentColor = "#6366f1", loading, sub, trend, size = "md",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor?: string;
  loading?: boolean;
  sub?: string;
  trend?: { value: number; label?: string };
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: accentColor }} />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
          <div
            className="p-2 rounded-xl shrink-0 opacity-80"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            {icon}
          </div>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-lg" />
              <div className="h-3 w-16 bg-slate-100 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <p className={`font-bold text-slate-900 tabular-nums ${size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl"}`}>
                {value}
              </p>
              {trend && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${trend.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {trend.value >= 0
                    ? <ArrowUpRight className="w-3.5 h-3.5" />
                    : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(trend.value).toFixed(1)}%
                  <span className="text-slate-400 font-normal">{trend.label ?? "vs mês anterior"}</span>
                </div>
              )}
              {sub && !trend && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Strip ─────────────────────────────────────────────────────────────
function MetricStrip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `${color}99` }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Financial() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("lancamentos");

  return (
    <AppLayout title="Controle Financeiro">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Controle Financeiro</h1>
            <p className="text-sm text-slate-400 mt-0.5">Acompanhamento de receitas, despesas e resultado</p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-200">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-8 w-32 rounded-lg border-0 bg-transparent text-sm font-semibold text-slate-700 focus:ring-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-slate-200" />
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-20 rounded-lg border-0 bg-transparent text-sm font-semibold text-slate-700 focus:ring-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-6 overflow-x-auto">
          <TabsList className="inline-flex bg-slate-100/80 rounded-xl p-1 gap-1 h-auto min-w-max">
            {[
              { value: "lancamentos", icon: <Receipt className="w-3.5 h-3.5" />, label: "Lançamentos" },
              { value: "custos", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Custo/Procedimento" },
              { value: "orcado", icon: <Target className="w-3.5 h-3.5" />, label: "Orçado vs Realizado" },
              { value: "dre", icon: <Activity className="w-3.5 h-3.5" />, label: "DRE Mensal" },
              { value: "despesas-fixas", icon: <Settings2 className="w-3.5 h-3.5" />, label: "Despesas Fixas" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 rounded-lg text-xs font-semibold px-4 py-2 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all whitespace-nowrap"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="lancamentos">
          <LancamentosTab month={month} year={year} />
        </TabsContent>
        <TabsContent value="custos">
          <CustosPorProcedimentoTab month={month} year={year} />
        </TabsContent>
        <TabsContent value="orcado">
          <OrcadoRealizadoTab month={month} year={year} />
        </TabsContent>
        <TabsContent value="dre">
          <DreTab month={month} year={year} />
        </TabsContent>
        <TabsContent value="despesas-fixas">
          <DespesasFixasTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: LANÇAMENTOS
// ═══════════════════════════════════════════════════════════════════════════════

interface BillingStatusData {
  lastRun: {
    id: number; ranAt: string; triggeredBy: string;
    generated: number; skipped: number; errors: number; processed: number; dryRun: boolean;
  } | null;
  upcoming: { id: number; patientName: string; procedureName: string; amount: number; nextBillingDate: string; }[];
  upcomingTotal: number;
  upcomingCount: number;
}

function LancamentosTab({ month, year }: { month: number; year: number }) {
  const [typeFilter, setTypeFilter] = useState<"all" | "receita" | "despesa">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string; amount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [billingRunning, setBillingRunning] = useState(false);
  const [billingResult, setBillingResult] = useState<{ generated: number; skipped: number; recordIds: number[] } | null>(null);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatusData | null>(null);
  const [billingStatusLoading, setBillingStatusLoading] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [billingPanelOpen, setBillingPanelOpen] = useState(false);
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useGetFinancialDashboard({ month, year });
  const { data: rawRecords, isLoading: recLoading, refetch: refetchRec } = useListFinancialRecords({ month, year });

  const fetchBillingStatus = useCallback(async () => {
    setBillingStatusLoading(true);
    try {
      const res = await fetch("/api/subscriptions/billing-status", { headers: authHeaders() });
      if (res.ok) setBillingStatus(await res.json());
    } catch { }
    finally { setBillingStatusLoading(false); }
  }, []);

  useEffect(() => { fetchBillingStatus(); }, [fetchBillingStatus]);

  const records = useMemo(() => {
    if (!rawRecords) return [];
    const sorted = [...rawRecords].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (typeFilter === "all") return sorted;
    return sorted.filter((r) => r.type === typeFilter);
  }, [rawRecords, typeFilter]);

  const totalReceitas = useMemo(() => records.filter((r) => r.type === "receita").reduce((s, r) => s + Number(r.amount), 0), [records]);
  const totalDespesas = useMemo(() => records.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0), [records]);

  const pieData = useMemo(() => {
    const cats = dashboard?.revenueByCategory ?? [];
    return cats.filter((c: any) => Number(c.revenue) > 0).map((c: any) => ({
      name: c.category === "null" || !c.category ? "Outros" : c.category,
      value: Number(c.revenue),
    }));
  }, [dashboard]);

  // Area chart data from category breakdown
  const areaData = useMemo(() => {
    if (!dashboard) return [];
    const cats = dashboard.revenueByCategory ?? [];
    return cats.filter((c: any) => Number(c.revenue) > 0).map((c: any, i: number) => ({
      name: c.category === "null" || !c.category ? "Outros" : c.category,
      receita: Number(c.revenue),
    }));
  }, [dashboard]);

  const handleSuccess = () => { setIsModalOpen(false); refetchDash(); refetchRec(); };

  const handleDeleteRecord = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/financial/records/${deleteTarget.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro ao excluir", description: data.message ?? "Não foi possível excluir." });
      } else {
        toast({ title: "Registro excluído." });
        setDeleteTarget(null);
        refetchDash(); refetchRec();
      }
    } catch { toast({ variant: "destructive", title: "Erro ao excluir registro." }); }
    finally { setIsDeleting(false); }
  };

  const handleRunBilling = async () => {
    setBillingRunning(true); setBillingResult(null);
    try {
      const res = await fetch("/api/subscriptions/run-billing", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erro na cobrança mensal", description: data.message });
      } else {
        setBillingResult(data);
        if (data.generated > 0) {
          toast({ title: `${data.generated} lançamento(s) gerado(s).` });
          refetchDash(); refetchRec();
        } else {
          toast({ title: data.skipped > 0 ? `Nenhuma cobrança nova — ${data.skipped} já registrada(s) ou fora da janela.` : "Nenhuma assinatura com vencimento na janela atual." });
        }
        await fetchBillingStatus();
      }
    } catch { toast({ variant: "destructive", title: "Erro ao executar cobrança." }); }
    finally { setBillingRunning(false); setShowBillingConfirm(false); }
  };

  const formatLastRunDate = (ranAt: string) => {
    const d = new Date(ranAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "agora mesmo";
    if (diffM < 60) return `há ${diffM} min`;
    if (diffH < 24) return `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatUpcomingDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return "hoje";
    if (diffDays === 1) return "amanhã";
    return `em ${diffDays} dias`;
  };

  const netProfit = (dashboard?.monthlyRevenue ?? 0) - (dashboard?.monthlyExpenses ?? 0);
  const isProfitable = netProfit >= 0;

  return (
    <div className="space-y-6">

      {/* ── Hero KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Receitas"
          value={formatCurrency(dashboard?.monthlyRevenue ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#10b981"
          loading={dashLoading}
        />
        <KpiCard
          label="Despesas"
          value={formatCurrency(dashboard?.monthlyExpenses ?? 0)}
          icon={<TrendingDown className="w-4 h-4" />}
          accentColor="#ef4444"
          loading={dashLoading}
        />
        <KpiCard
          label="Lucro Líquido"
          value={formatCurrency(dashboard?.monthlyProfit ?? 0)}
          icon={<DollarSign className="w-4 h-4" />}
          accentColor="#6366f1"
          loading={dashLoading}
          size="md"
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(dashboard?.averageTicket ?? 0)}
          icon={<Ticket className="w-4 h-4" />}
          accentColor="#8b5cf6"
          loading={dashLoading}
        />
        <KpiCard
          label="Consultas"
          value={`${dashboard?.completedAppointments ?? 0} / ${dashboard?.totalAppointments ?? 0}`}
          icon={<Stethoscope className="w-4 h-4" />}
          accentColor="#0ea5e9"
          loading={dashLoading}
          sub={dashboard?.topProcedure ? `Top: ${dashboard.topProcedure}` : undefined}
        />
      </div>

      {/* ── Net Result Banner ── */}
      {!dashLoading && (
        <div className={`rounded-2xl px-5 py-4 flex items-center justify-between gap-4 ${isProfitable ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isProfitable ? "bg-emerald-100" : "bg-red-100"}`}>
              {isProfitable
                ? <TrendingUp className="w-5 h-5 text-emerald-600" />
                : <TrendingDown className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className={`text-sm font-bold ${isProfitable ? "text-emerald-800" : "text-red-800"}`}>
                {isProfitable ? "Clínica no positivo" : "Atenção: resultado negativo"} — {MONTH_NAMES[month - 1]} {year}
              </p>
              <p className={`text-xs ${isProfitable ? "text-emerald-600" : "text-red-600"}`}>
                {isProfitable
                  ? `Resultado: +${formatCurrency(netProfit)} acima das despesas`
                  : `Resultado: ${formatCurrency(netProfit)} abaixo das receitas`}
              </p>
            </div>
          </div>
          <span className={`text-xl font-extrabold tabular-nums ${isProfitable ? "text-emerald-700" : "text-red-700"}`}>
            {isProfitable ? "+" : ""}{formatCurrency(netProfit)}
          </span>
        </div>
      )}

      {/* ── MRR & Subscription Metrics ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Repeat className="w-3 h-3" /> Receita Recorrente (Assinaturas)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="MRR — Receita Mensal Recorrente"
            value={formatCurrency((dashboard as any)?.mrr ?? 0)}
            icon={<Repeat className="w-4 h-4" />}
            accentColor="#6366f1"
            loading={dashLoading}
            sub={`${(dashboard as any)?.activeSubscriptions ?? 0} assinatura(s) ativa(s)`}
          />
          <KpiCard
            label="A Receber — Cobranças Pendentes"
            value={formatCurrency((dashboard as any)?.pendingSubscriptionCharges?.total ?? 0)}
            icon={<Clock className="w-4 h-4" />}
            accentColor="#f59e0b"
            loading={dashLoading}
            sub={`${(dashboard as any)?.pendingSubscriptionCharges?.count ?? 0} lançamento(s)`}
          />
          <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-indigo-400" />
            <div className="pl-5 pr-4 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Cobertura do MRR</p>
              {dashLoading ? (
                <div className="h-7 w-24 bg-slate-100 animate-pulse rounded-lg" />
              ) : (() => {
                const mrr = (dashboard as any)?.mrr ?? 0;
                const revenue = dashboard?.monthlyRevenue ?? 0;
                const pct = revenue > 0 ? Math.min(100, Math.round((mrr / revenue) * 100)) : (mrr > 0 ? 100 : 0);
                return (
                  <>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{pct}%</p>
                    <p className="text-xs text-slate-400 mt-1">do total de receitas é recorrente</p>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Revenue by Category (Donut) */}
        {pieData.length > 0 && (
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">Receita por Categoria</CardTitle>
              <p className="text-xs text-slate-400">{MONTH_NAMES[month - 1]} {year}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: "12px" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Revenue Category Bar Chart */}
        {areaData.length > 0 && (
          <Card className={`border border-slate-100 shadow-sm rounded-2xl bg-white ${pieData.length > 0 ? "xl:col-span-3" : "xl:col-span-5"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700">Distribuição por Categoria</CardTitle>
              <p className="text-xs text-slate-400">Receita gerada por tipo de serviço</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={areaData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: "12px" }}
                  />
                  <Bar dataKey="receita" name="Receita" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* If no pie data, show a placeholder or nothing */}
        {pieData.length === 0 && areaData.length === 0 && (
          <div className="xl:col-span-5 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center p-10 text-center bg-slate-50">
            <div>
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">Nenhum dado para exibir nos gráficos</p>
              <p className="text-xs text-slate-300 mt-1">Adicione lançamentos de receita para visualizar a distribuição</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Subscription Billing Panel (Collapsible) ── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setBillingPanelOpen(v => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-100">
              <CalendarCheck2 className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">Cobrança de Assinaturas</p>
              <p className="text-xs text-slate-400">
                {billingStatus?.lastRun
                  ? `Última execução: ${formatLastRunDate(billingStatus.lastRun.ranAt)}`
                  : "Nenhuma execução registrada"
                }
                {" · "}
                <span className="font-semibold text-violet-600">Automático: diariamente às 06:00</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(billingStatus?.upcomingCount ?? 0) > 0 && (
              <span className="text-[11px] font-bold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
                {billingStatus!.upcomingCount} vencendo
              </span>
            )}
            {billingPanelOpen
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {billingPanelOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
            {/* Status row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                {billingStatusLoading ? (
                  <div className="h-4 w-40 bg-slate-200 animate-pulse rounded" />
                ) : billingStatus?.lastRun ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold">Última execução:</span>{" "}
                      {formatLastRunDate(billingStatus.lastRun.ranAt)}
                      {" · "}{billingStatus.lastRun.triggeredBy === "scheduler" ? "automática" : "manual"}
                      {" · "}
                      <span className={billingStatus.lastRun.generated > 0 ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                        {billingStatus.lastRun.generated > 0
                          ? `${billingStatus.lastRun.generated} gerada(s)`
                          : "nenhuma gerada"}
                      </span>
                      {billingStatus.lastRun.errors > 0 && (
                        <span className="text-red-500 font-semibold"> · {billingStatus.lastRun.errors} erro(s)</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-400">Nenhuma execução registrada ainda</p>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                {billingStatusLoading ? (
                  <div className="h-4 w-36 bg-slate-200 animate-pulse rounded" />
                ) : (billingStatus?.upcomingCount ?? 0) > 0 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-amber-600">{billingStatus!.upcomingCount} assinatura(s)</span>
                      {" "}vencem nos próximos 7 dias{" · "}
                      <span className="font-semibold">{formatCurrency(billingStatus!.upcomingTotal)}</span>
                      <button
                        className="ml-1 text-violet-500 hover:text-violet-700 font-semibold"
                        onClick={() => setShowUpcoming(v => !v)}
                      >
                        {showUpcoming ? "ocultar" : "ver"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-400">Nenhuma assinatura vence nos próximos 7 dias</p>
                  </>
                )}
              </div>
            </div>

            {/* Upcoming list */}
            {showUpcoming && (billingStatus?.upcoming?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                {billingStatus!.upcoming.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                    <span className="text-slate-700 truncate flex-1">
                      <span className="font-semibold">{s.patientName}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-500">{s.procedureName}</span>
                    </span>
                    <span className="text-amber-600 font-semibold shrink-0">{formatUpcomingDate(s.nextBillingDate)}</span>
                    <span className="text-slate-900 font-bold shrink-0">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Billing result */}
            {billingResult !== null && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${billingResult.generated > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {billingResult.generated > 0
                  ? `${billingResult.generated} lançamento(s) gerado(s) agora`
                  : "Nenhum lançamento gerado — assinaturas já cobradas ou fora da janela"}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 h-8 text-xs font-semibold"
                onClick={() => setShowBillingConfirm(true)}
                disabled={billingRunning}
              >
                {billingRunning
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Executar cobrança agora
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction List ── */}
      <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="pb-0 px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Lançamentos</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">{records.length} registro(s) · {MONTH_NAMES[month - 1]} {year}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter pills */}
              <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                {(["all", "receita", "despesa"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === t
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {t === "all" ? "Todos" : t === "receita" ? "Entradas" : "Saídas"}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => setIsModalOpen(true)}
                size="sm"
                className="rounded-xl h-8 px-3 text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {recLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-16 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-20 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-16 bg-slate-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Nenhum registro encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Adicione receitas e despesas para visualizar os lançamentos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Categoria</th>
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Status</th>
                    <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                    <th className="py-2.5 px-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => {
                    const displayDate = (record as any).paymentDate ?? (record as any).dueDate ?? record.createdAt;
                    const recStatus: string = (record as any).status ?? "pago";
                    const statusCfg: Record<string, { label: string; dot: string; text: string }> = {
                      pago: { label: "Pago", dot: "bg-emerald-400", text: "text-emerald-700" },
                      pendente: { label: "Pendente", dot: "bg-amber-400", text: "text-amber-700" },
                      estornado: { label: "Estornado", dot: "bg-red-400", text: "text-red-600" },
                      cancelado: { label: "Cancelado", dot: "bg-slate-300", text: "text-slate-500" },
                    };
                    const { label: statusLabel, dot: statusDot, text: statusText } = statusCfg[recStatus] ?? { label: recStatus, dot: "bg-slate-300", text: "text-slate-500" };
                    return (
                      <tr
                        key={record.id}
                        className="group border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-3.5 px-5 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                          {format(new Date(displayDate), "dd/MM/yy")}
                        </td>
                        <td className="py-3.5 px-5 text-sm font-medium text-slate-800 max-w-[180px] truncate">
                          {record.description}
                        </td>
                        <td className="py-3.5 px-5 hidden md:table-cell">
                          {(record as any).procedureName ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                              <Link2 className="w-3 h-3" />
                              {(record as any).procedureName}
                            </span>
                          ) : record.category ? (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                              {record.category}
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${record.type === "receita"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${record.type === "receita" ? "bg-emerald-500" : "bg-red-500"}`} />
                            {record.type === "receita" ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusText}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className={`py-3.5 px-5 text-sm font-bold text-right whitespace-nowrap tabular-nums ${record.type === "receita" ? "text-emerald-600" : "text-red-600"}`}>
                          {record.type === "receita" ? "+" : "−"}{formatCurrency(Number(record.amount))}
                        </td>
                        <td className="py-3.5 px-3 w-10">
                          <button
                            onClick={() => setDeleteTarget({ id: record.id, description: record.description, amount: Number(record.amount) })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {records.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={5} className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">
                        Totais do período
                      </td>
                      <td colSpan={2} className="py-3 px-5 md:hidden" />
                      <td className="py-3 px-5 text-right">
                        {typeFilter !== "despesa" && (
                          <p className="text-sm font-bold text-emerald-600 tabular-nums">+{formatCurrency(totalReceitas)}</p>
                        )}
                        {typeFilter !== "receita" && (
                          <p className="text-sm font-bold text-red-600 tabular-nums">−{formatCurrency(totalDespesas)}</p>
                        )}
                        {typeFilter === "all" && (
                          <p className={`text-sm font-extrabold mt-0.5 tabular-nums ${totalReceitas - totalDespesas >= 0 ? "text-indigo-600" : "text-red-700"}`}>
                            {formatCurrency(totalReceitas - totalDespesas)}
                          </p>
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <NewRecordModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir Registro</DialogTitle>
            <DialogDescription>
              Confirmar exclusão de <strong>{deleteTarget?.description}</strong> ({formatCurrency(deleteTarget?.amount ?? 0)})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteRecord} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBillingConfirm} onOpenChange={setShowBillingConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Executar Cobrança Mensal</DialogTitle>
            <DialogDescription>
              Gera lançamentos financeiros para todas as assinaturas ativas com vencimento em aberto (janela de 3 dias). Esta ação é segura e idempotente — assinaturas já cobradas no mês não serão duplicadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBillingConfirm(false)}>Cancelar</Button>
            <Button onClick={handleRunBilling} disabled={billingRunning}>
              {billingRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: CUSTO POR PROCEDIMENTO
// ═══════════════════════════════════════════════════════════════════════════════

function CustosPorProcedimentoTab({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/cost-per-procedure?month=${month}&year=${year}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch { }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const procedures = data?.procedures ?? [];
  const hasData = procedures.length > 0;

  const chartData = procedures
    .filter((p: any) => p.price > 0)
    .map((p: any) => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
      preço: p.price,
      custoEstimado: p.estimatedTotalCostPerSession,
      custoReal: p.realTotalCostPerSession,
      margemEst: Math.max(0, p.estimatedMarginPerSession),
      margemReal: Math.max(0, p.realMarginPerSession),
    }));

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="h-3 w-20 bg-slate-100 animate-pulse rounded mb-3" />
            <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Despesas Reais (mês)" value={formatCurrency(data?.totalRealOverhead ?? 0)} icon={<TrendingDown className="w-4 h-4" />} accentColor="#ef4444" />
        <KpiCard label="Despesas Estimadas" value={formatCurrency(data?.totalEstimatedOverhead ?? 0)} icon={<Target className="w-4 h-4" />} accentColor="#f59e0b" />
        <KpiCard label="Horas Disponíveis" value={`${data?.totalAvailableHours ?? 0}h`} icon={<Clock className="w-4 h-4" />} accentColor="#0ea5e9" />
        <KpiCard label="Custo/Hora Real" value={formatCurrency(data?.realCostPerHour ?? 0)} icon={<Activity className="w-4 h-4" />} accentColor="#8b5cf6" sub={`Estimado: ${formatCurrency(data?.estCostPerHour ?? 0)}/h`} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Preço vs Custo por Procedimento</CardTitle>
            <p className="text-xs text-slate-400">Comparação de preço de venda com custo estimado e custo real rateado</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `R$${v}`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="preço" name="Preço" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custoEstimado" name="Custo Estimado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custoReal" name="Custo Real" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Análise Detalhada por Procedimento</CardTitle>
          <p className="text-xs text-slate-400">{MONTH_NAMES[month - 1]} {year} · Margem = Preço − Custo Direto − Overhead Rateado</p>
        </CardHeader>
        <CardContent className="p-0">
          {!hasData ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Nenhum procedimento encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Cadastre procedimentos para ver a análise de custos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Procedimento</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Preço</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Custo Direto</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Overhead Est.</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Custo Total</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden lg:table-cell">Custo Real</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Margem Est.</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden lg:table-cell">Margem Real</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Sessões</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((p: any) => {
                    const marginOk = p.estimatedMarginPct >= 30;
                    const marginWarn = p.estimatedMarginPct >= 10 && p.estimatedMarginPct < 30;
                    return (
                      <tr key={p.procedureId} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{p.category} · {p.durationMinutes}min</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-slate-800 text-right tabular-nums">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-sm text-slate-500 text-right tabular-nums">{formatCurrency(p.estimatedDirectCost)}</td>
                        <td className="py-3 px-4 text-sm text-slate-500 text-right hidden md:table-cell tabular-nums">{formatCurrency(p.estimatedOverheadPerSession)}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-amber-700 text-right tabular-nums">{formatCurrency(p.estimatedTotalCostPerSession)}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-red-600 text-right hidden lg:table-cell tabular-nums">{formatCurrency(p.realTotalCostPerSession)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-sm font-bold tabular-nums ${marginOk ? "text-emerald-600" : marginWarn ? "text-amber-600" : "text-red-600"}`}>
                              {formatCurrency(p.estimatedMarginPerSession)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${marginOk ? "bg-emerald-100 text-emerald-700" : marginWarn ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.estimatedMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right hidden lg:table-cell">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-sm font-bold tabular-nums ${p.realMarginPerSession >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {formatCurrency(p.realMarginPerSession)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.realMarginPct >= 30 ? "bg-emerald-100 text-emerald-700" : p.realMarginPct >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.realMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-center hidden md:table-cell">
                          <span className="text-slate-700 font-medium">{p.completedSessions}</span>
                          <span className="text-slate-300 text-xs">/{p.scheduledSessions}</span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-emerald-600 text-right hidden md:table-cell tabular-nums">
                          {p.revenueGenerated > 0 ? formatCurrency(p.revenueGenerated) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <strong>Como funciona o rateio:</strong> O custo overhead por hora é calculado dividindo o total de despesas pagas no mês pelas horas clínicas disponíveis (baseado nos horários de funcionamento cadastrados). Esse valor é então multiplicado pela duração de cada procedimento.
          Configure as <strong>Despesas Fixas</strong> para obter estimativas mais precisas.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: ORÇADO VS REALIZADO
// ═══════════════════════════════════════════════════════════════════════════════

function OrcadoRealizadoTab({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/dre?month=${month}&year=${year}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch { }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const est = data?.estimated ?? {};
  const cur = data?.current ?? {};
  const variance = data?.variance ?? {};

  const revPct = est.revenue > 0 ? Math.min(100, (cur.grossRevenue / est.revenue) * 100) : 0;
  const expPct = est.expenses > 0 ? Math.min(100, (cur.totalExpenses / est.expenses) * 100) : 0;

  const hasRecurring = (data?.recurringExpenses ?? []).length > 0;

  return (
    <div className="space-y-6">
      {!hasRecurring && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Despesas fixas não configuradas</p>
            <p className="text-xs text-amber-600 mt-0.5">Configure suas despesas fixas recorrentes na aba "Despesas Fixas" para obter estimativas precisas de orçamento.</p>
          </div>
        </div>
      )}

      {/* Revenue comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue */}
        <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">Receita</CardTitle>
            <p className="text-xs text-slate-400">Realizado vs Orçado</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Realizado</p>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{formatCurrency(cur.grossRevenue ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orçado</p>
                <p className="text-lg font-semibold text-slate-400 tabular-nums">{formatCurrency(est.revenue ?? 0)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Execução</span>
                <span className="font-semibold">{revPct.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${revPct >= 90 ? "bg-emerald-500" : revPct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${revPct}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {variance.revenueVariancePct !== undefined && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${variance.revenueVariancePct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {variance.revenueVariancePct >= 0 ? "+" : ""}{variance.revenueVariancePct?.toFixed(1)}% vs orçado
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">Despesas</CardTitle>
            <p className="text-xs text-slate-400">Realizado vs Orçado</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Realizado</p>
                <p className="text-2xl font-bold text-red-600 tabular-nums">{formatCurrency(cur.totalExpenses ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orçado</p>
                <p className="text-lg font-semibold text-slate-400 tabular-nums">{formatCurrency(est.expenses ?? 0)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Utilização do orçamento</span>
                <span className="font-semibold">{expPct.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${expPct <= 80 ? "bg-emerald-500" : expPct <= 100 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${Math.min(expPct, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {variance.expenseVariancePct !== undefined && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${variance.expenseVariancePct <= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {variance.expenseVariancePct >= 0 ? "+" : ""}{variance.expenseVariancePct?.toFixed(1)}% vs orçado
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Result */}
      <Card className={`border shadow-sm rounded-2xl overflow-hidden ${(cur.netProfit ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Resultado Líquido</p>
            <p className={`text-3xl font-extrabold tabular-nums ${(cur.netProfit ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatCurrency(cur.netProfit ?? 0)}
            </p>
            {est.netProfit !== undefined && (
              <p className="text-xs text-slate-500 mt-1">Orçado: {formatCurrency(est.netProfit)}</p>
            )}
          </div>
          {cur.netMarginPct !== undefined && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Margem Líquida</p>
              <p className={`text-2xl font-extrabold ${cur.netMarginPct >= 20 ? "text-emerald-700" : cur.netMarginPct >= 10 ? "text-amber-700" : "text-red-700"}`}>
                {cur.netMarginPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Meta: ≥ 20%</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recurring Expenses breakdown */}
      {(data?.recurringExpenses ?? []).length > 0 && (
        <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-500" /> Despesas Fixas Configuradas
            </CardTitle>
            <p className="text-xs text-slate-400">Base para o orçamento estimado de despesas</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.recurringExpenses.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.category} · {r.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600 tabular-nums">{formatCurrency(r.amount)}</p>
                    {r.frequency !== "mensal" && (
                      <p className="text-[11px] text-slate-400 tabular-nums">≈ {formatCurrency(r.monthlyEquivalent)}/mês</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between font-bold text-sm pt-3 border-t border-slate-200">
                <span className="text-slate-700">Total Mensal Estimado</span>
                <span className="text-red-600 tabular-nums">{formatCurrency(est.expenses ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: DRE MENSAL
// ═══════════════════════════════════════════════════════════════════════════════

function DreTab({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/dre?month=${month}&year=${year}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch { }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const est = data?.estimated ?? {};
  const cur = data?.current ?? {};
  const prev = data?.previousMonth ?? {};
  const variance = data?.variance ?? {};

  function ChangeChip({ value, inverted }: { value: number; inverted?: boolean }) {
    const positive = inverted ? value <= 0 : value >= 0;
    if (value === 0) return <span className="text-[10px] text-slate-300 font-medium">—</span>;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {value >= 0 ? "+" : ""}{value.toFixed(1)}%
      </span>
    );
  }

  function DreRow({ label, current, previous, estimated, isTotal, isSubtotal, isNegative, indent }: {
    label: string; current: number; previous?: number; estimated?: number;
    isTotal?: boolean; isSubtotal?: boolean; isNegative?: boolean; indent?: boolean;
  }) {
    const pctChange = previous && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
    const executionPct = estimated && estimated !== 0 ? (current / estimated) * 100 : null;
    return (
      <tr className={`border-b border-slate-50 ${isTotal ? "bg-primary/5" : isSubtotal ? "bg-slate-50/80" : "hover:bg-slate-50/40"} transition-colors`}>
        <td className={`py-3 px-5 text-sm ${indent ? "pl-10 text-slate-400 font-normal" : isTotal ? "font-extrabold text-slate-900" : isSubtotal ? "font-bold text-slate-700" : "text-slate-600"}`}>
          {label}
        </td>
        {estimated !== undefined && (
          <td className="py-3 px-4 text-sm text-right text-slate-400 tabular-nums">{formatCurrency(estimated)}</td>
        )}
        {previous !== undefined && (
          <td className="py-3 px-4 text-sm text-right text-slate-400 tabular-nums">{formatCurrency(previous)}</td>
        )}
        <td className={`py-3 px-5 text-sm text-right font-semibold tabular-nums ${isTotal ? (current >= 0 ? "text-primary font-extrabold" : "text-red-600 font-extrabold") : isNegative ? "text-red-600" : current < 0 ? "text-red-600" : "text-slate-800"}`}>
          {isNegative && current > 0 ? `(${formatCurrency(current)})` : formatCurrency(current)}
        </td>
        {previous !== undefined && (
          <td className="py-3 px-4 text-right">
            <ChangeChip value={pctChange} inverted={isNegative} />
          </td>
        )}
        {executionPct !== null && (
          <td className="py-3 px-4 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${executionPct >= 90 ? "bg-emerald-500" : executionPct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${Math.min(100, executionPct)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{executionPct.toFixed(0)}%</span>
            </div>
          </td>
        )}
      </tr>
    );
  }

  const hasEstimated = est.revenue > 0 || est.expenses > 0;
  const hasPrev = prev.grossRevenue !== undefined;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Receita Bruta"
          value={formatCurrency(cur.grossRevenue ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          accentColor="#10b981"
          trend={hasPrev && prev.grossRevenue ? { value: ((cur.grossRevenue - prev.grossRevenue) / Math.abs(prev.grossRevenue)) * 100 } : undefined}
        />
        <KpiCard
          label="Total Despesas"
          value={formatCurrency(cur.totalExpenses ?? 0)}
          icon={<TrendingDown className="w-4 h-4" />}
          accentColor="#ef4444"
          trend={hasPrev && prev.totalExpenses ? { value: ((cur.totalExpenses - prev.totalExpenses) / Math.abs(prev.totalExpenses)) * 100 } : undefined}
        />
        <KpiCard
          label="Resultado Líquido"
          value={formatCurrency(cur.netProfit ?? 0)}
          icon={<DollarSign className="w-4 h-4" />}
          accentColor="#6366f1"
          trend={variance.netProfitChangeVsPrevMonth ? { value: variance.netProfitChangeVsPrevMonth } : undefined}
        />
        <KpiCard
          label="Margem Líquida"
          value={`${cur.netMarginPct?.toFixed(1) ?? 0}%`}
          icon={<PiggyBank className="w-4 h-4" />}
          accentColor="#8b5cf6"
          sub="Meta: ≥ 20%"
        />
      </div>

      {/* DRE Table */}
      <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">Demonstrativo de Resultado</CardTitle>
          <p className="text-xs text-slate-400">{MONTH_NAMES[month - 1]} {year}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item</th>
                  {hasEstimated && <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Orçado</th>}
                  {hasPrev && <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Mês Ant.</th>}
                  <th className="py-2.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Realizado</th>
                  {hasPrev && <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Variação</th>}
                  {hasEstimated && <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Execução</th>}
                </tr>
              </thead>
              <tbody>
                <DreRow
                  label="(+) Receita Bruta"
                  current={cur.grossRevenue ?? 0}
                  previous={hasPrev ? prev.grossRevenue : undefined}
                  estimated={hasEstimated ? est.revenue : undefined}
                  isSubtotal
                />
                {(cur.expensesByCategory ?? []).map((cat: any) => (
                  <DreRow key={cat.category} label={cat.category} current={cat.amount} indent isNegative />
                ))}
                {(cur.expensesByCategory ?? []).length > 0 && (
                  <DreRow
                    label="(−) Total Despesas"
                    current={cur.totalExpenses ?? 0}
                    previous={hasPrev ? prev.totalExpenses : undefined}
                    estimated={hasEstimated ? est.expenses : undefined}
                    isSubtotal
                    isNegative
                  />
                )}
                <DreRow
                  label="(=) Resultado Líquido"
                  current={cur.netProfit ?? 0}
                  previous={hasPrev ? prev.netProfit : undefined}
                  estimated={hasEstimated ? est.netProfit : undefined}
                  isTotal
                />
              </tbody>
            </table>
          </div>

          {/* Margin footer */}
          <div className={`grid gap-px bg-slate-100 border-t border-slate-200 ${hasEstimated && hasPrev ? "grid-cols-3" : hasEstimated || hasPrev ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasEstimated && (
              <div className="bg-white py-3 px-5 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Margem Estimada</p>
                <p className="text-base font-bold text-slate-500 mt-0.5 tabular-nums">
                  {est.revenue > 0 ? ((est.netProfit / est.revenue) * 100).toFixed(1) : 0}%
                </p>
              </div>
            )}
            {hasPrev && (
              <div className="bg-white py-3 px-5 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Margem Anterior</p>
                <p className="text-base font-bold text-slate-500 mt-0.5 tabular-nums">{prev.netMarginPct?.toFixed(1) ?? 0}%</p>
              </div>
            )}
            <div className={`py-3 px-5 text-center ${(cur.netMarginPct ?? 0) >= 20 ? "bg-emerald-50" : (cur.netMarginPct ?? 0) >= 10 ? "bg-amber-50" : "bg-red-50"}`}>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Margem Realizada</p>
              <p className={`text-base font-bold mt-0.5 tabular-nums ${(cur.netMarginPct ?? 0) >= 20 ? "text-emerald-700" : (cur.netMarginPct ?? 0) >= 10 ? "text-amber-700" : "text-red-700"}`}>
                {cur.netMarginPct?.toFixed(1) ?? 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recurring expenses breakdown */}
      {(data?.recurringExpenses ?? []).length > 0 && (
        <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-500" /> Despesas Fixas Configuradas
            </CardTitle>
            <p className="text-xs text-slate-400">Base para o orçamento estimado de despesas</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.recurringExpenses.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.category} · {r.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600 tabular-nums">{formatCurrency(r.amount)}</p>
                    {r.frequency !== "mensal" && (
                      <p className="text-[11px] text-slate-400 tabular-nums">≈ {formatCurrency(r.monthlyEquivalent)}/mês</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between font-bold text-sm pt-3 border-t border-slate-200">
                <span className="text-slate-700">Total Mensal Estimado</span>
                <span className="text-red-600 tabular-nums">{formatCurrency(est.expenses ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: DESPESAS FIXAS RECORRENTES
// ═══════════════════════════════════════════════════════════════════════════════

function DespesasFixasTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recurring-expenses", { headers: authHeaders() });
      if (res.ok) setRecords(await res.json());
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const totalMonthly = records.filter(r => r.isActive).reduce((sum, r) => {
    const amt = Number(r.amount);
    if (r.frequency === "anual") return sum + amt / 12;
    if (r.frequency === "semanal") return sum + amt * 4.33;
    return sum + amt;
  }, 0);

  const toggleActive = async (record: any) => {
    try {
      const res = await fetch(`/api/recurring-expenses/${record.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !record.isActive }),
      });
      if (res.ok) { fetchRecords(); toast({ title: record.isActive ? "Despesa desativada." : "Despesa ativada." }); }
    } catch { toast({ variant: "destructive", title: "Erro ao atualizar." }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recurring-expenses/${deleteTarget.id}`, { method: "DELETE", headers: authHeaders() });
      if (res.ok) { toast({ title: "Despesa removida." }); setDeleteTarget(null); fetchRecords(); }
      else toast({ variant: "destructive", title: "Erro ao remover." });
    } catch { toast({ variant: "destructive", title: "Erro ao remover." }); }
    finally { setIsDeleting(false); }
  };

  const categoryGroups = records.reduce((acc: Record<string, any[]>, r) => {
    const cat = r.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const freqLabel: Record<string, string> = { mensal: "/mês", anual: "/ano (÷12)", semanal: "/sem (×4,33)" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Despesas Fixas Recorrentes</h2>
          <p className="text-sm text-slate-400 mt-0.5">Configure suas despesas fixas para calcular o orçamento estimado e o custo por hora clínico.</p>
        </div>
        <Button
          onClick={() => { setEditTarget(null); setIsModalOpen(true); }}
          size="sm"
          className="rounded-xl shadow-sm h-9 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nova Despesa
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Mensal Estimado" value={formatCurrency(totalMonthly)} icon={<Receipt className="w-4 h-4" />} accentColor="#ef4444" />
        <KpiCard label="Despesas Cadastradas" value={String(records.length)} icon={<Settings2 className="w-4 h-4" />} accentColor="#64748b" sub={`${records.filter(r => r.isActive).length} ativa(s)`} />
        <KpiCard label="Total Anual Estimado" value={formatCurrency(totalMonthly * 12)} icon={<CalendarDays className="w-4 h-4" />} accentColor="#8b5cf6" />
        <KpiCard label="Categorias" value={String(Object.keys(categoryGroups).length)} icon={<BarChart3 className="w-4 h-4" />} accentColor="#0ea5e9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : records.length === 0 ? (
        <Card className="border border-dashed border-slate-200 shadow-none rounded-2xl bg-slate-50">
          <CardContent className="py-14 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <PiggyBank className="w-7 h-7 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600">Nenhuma despesa fixa cadastrada</p>
            <p className="text-sm text-slate-400 mt-1 mb-5 max-w-sm mx-auto">
              Adicione aluguel, salários, contas e outros custos fixos para habilitar o cálculo de custo por procedimento e o orçamento estimado.
            </p>
            <Button
              onClick={() => { setEditTarget(null); setIsModalOpen(true); }}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar primeira despesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(categoryGroups).map(([cat, items]) => {
            const catMonthly = items.filter((r: any) => r.isActive).reduce((s: number, r: any) => {
              const a = Number(r.amount);
              return s + (r.frequency === "anual" ? a / 12 : r.frequency === "semanal" ? a * 4.33 : a);
            }, 0);
            return (
              <Card key={cat} className="border border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{cat}</p>
                  <p className="text-xs font-bold text-slate-600 tabular-nums">{formatCurrency(catMonthly)}/mês</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {items.map((r: any) => (
                    <div key={r.id} className={`flex items-center gap-4 px-5 py-3.5 transition-opacity ${!r.isActive ? "opacity-40" : ""}`}>
                      <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${r.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>{r.name}</p>
                        {r.notes && <p className="text-[11px] text-slate-400 truncate mt-0.5">{r.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(Number(r.amount))}</p>
                        <p className="text-[11px] text-slate-400">{freqLabel[r.frequency] ?? r.frequency}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditTarget(r); setIsModalOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RecurringExpenseModal
        open={isModalOpen}
        editData={editTarget}
        onClose={() => { setIsModalOpen(false); setEditTarget(null); }}
        onSuccess={() => { setIsModalOpen(false); setEditTarget(null); fetchRecords(); }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Remover Despesa Fixa</DialogTitle>
            <DialogDescription>
              Confirmar remoção de <strong>{deleteTarget?.name}</strong>? Isso não afetará registros financeiros já gerados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Modal: Recurring Expense Form ───────────────────────────────────────────

function RecurringExpenseModal({ open, editData, onClose, onSuccess }: {
  open: boolean; editData: any | null; onClose: () => void; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("mensal");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editData) {
      setName(editData.name ?? "");
      setCategory(editData.category ?? "");
      setAmount(String(editData.amount ?? ""));
      setFrequency(editData.frequency ?? "mensal");
      setNotes(editData.notes ?? "");
    } else {
      setName(""); setCategory(""); setAmount(""); setFrequency("mensal"); setNotes("");
    }
  }, [editData, open]);

  const handleSubmit = async () => {
    if (!name || !category || !amount) {
      toast({ variant: "destructive", title: "Preencha nome, categoria e valor." }); return;
    }
    setSaving(true);
    try {
      const url = editData ? `/api/recurring-expenses/${editData.id}` : "/api/recurring-expenses";
      const method = editData ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ name, category, amount: Number(amount), frequency, notes: notes || undefined }),
      });
      if (res.ok) { toast({ title: editData ? "Despesa atualizada." : "Despesa cadastrada." }); onSuccess(); }
      else { const d = await res.json().catch(() => ({})); toast({ variant: "destructive", title: d.message ?? "Erro ao salvar." }); }
    } catch { toast({ variant: "destructive", title: "Erro ao salvar." }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}</DialogTitle>
          <DialogDescription>Despesas fixas são usadas para calcular o orçamento estimado e o custo por hora clínico.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Nome *</Label>
            <Input id="rec-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aluguel, Salário, Internet…" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-cat">Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="rec-cat" className="rounded-xl"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {RECURRING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amt">Valor (R$) *</Label>
              <Input id="rec-amt" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-freq">Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="rec-freq" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {amount && frequency === "anual" && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
              Equivalente mensal: <strong className="text-slate-600 tabular-nums">{formatCurrency(Number(amount) / 12)}</strong>
            </p>
          )}
          {amount && frequency === "semanal" && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
              Equivalente mensal: <strong className="text-slate-600 tabular-nums">{formatCurrency(Number(amount) * 4.33)}</strong>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rec-notes">Observações</Label>
            <Input id="rec-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional…" className="rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editData ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: New Financial Record ──────────────────────────────────────────────

function NewRecordModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<"receita" | "despesa">("despesa");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [expenseSubtype, setExpenseSubtype] = useState<"geral" | "procedimento">("geral");
  const [procedureId, setProcedureId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { data: procedures } = useListProcedures();
  const { mutateAsync: createRecord } = useCreateFinancialRecord();

  const categories = type === "receita"
    ? REVENUE_CATEGORIES
    : expenseSubtype === "geral"
      ? GENERAL_EXPENSE_CATEGORIES
      : PROCEDURE_EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!open) {
      setType("despesa"); setAmount(""); setDescription("");
      setCategory(""); setExpenseSubtype("geral"); setProcedureId("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!amount || !description) {
      toast({ variant: "destructive", title: "Preencha descrição e valor." }); return;
    }
    setSaving(true);
    try {
      await createRecord({
        data: {
          type,
          amount: Number(amount),
          description,
          category: category || undefined,
          procedureId: procedureId ? Number(procedureId) : undefined,
        } as any,
      });
      toast({ title: "Lançamento criado com sucesso." });
      onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", title: err?.message ?? "Erro ao criar lançamento." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa manualmente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(["receita", "despesa"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setCategory(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${type === t
                  ? t === "receita"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-red-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          {type === "despesa" && (
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
              {(["geral", "procedimento"] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => { setExpenseSubtype(sub); setCategory(""); setProcedureId(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${expenseSubtype === sub ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
                >
                  {sub === "geral" ? "Despesa Geral" : "Custo de Procedimento"}
                </button>
              ))}
            </div>
          )}

          {type === "despesa" && expenseSubtype === "procedimento" && (
            <div className="space-y-1.5">
              <Label>Procedimento vinculado</Label>
              <Select value={procedureId} onValueChange={setProcedureId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {(procedures ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Pagamento de aluguel, Consulta Dr. Silva…" className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="number" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0,00" className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className={type === "receita" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {type === "receita" ? "Registrar Receita" : "Registrar Despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
