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
  XCircle, ArrowUpRight, ArrowDownRight, Minus, Edit2,
  PiggyBank, Activity, AlertCircle, Flame, TrendingUpIcon,
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
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, iconBg, accent, loading, sub, highlight, trend
}: {
  label: string; value: string; icon: React.ReactNode;
  iconBg?: string; accent?: string; loading?: boolean;
  sub?: string; highlight?: boolean; trend?: { value: number; label?: string };
}) {
  return (
    <Card className={`border-none shadow-md rounded-2xl overflow-hidden ${accent ?? "bg-white"}`}>
      <CardContent className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
          <div className={`p-2 rounded-xl ${iconBg ?? "bg-slate-100 text-slate-500"}`}>{icon}</div>
        </div>
        {loading ? (
          <div className="h-7 w-24 bg-slate-200 animate-pulse rounded mt-1" />
        ) : (
          <p className={`text-xl font-bold ${highlight ? "text-primary" : "text-slate-800"}`}>{value}</p>
        )}
        {trend && !loading && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trend.value >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend.value).toFixed(1)}% {trend.label ?? "vs mês anterior"}
          </div>
        )}
        {sub && !loading && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Financial() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("lancamentos");

  return (
    <AppLayout title="Controle Financeiro">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200 w-fit mb-6">
        <CalendarDays className="w-5 h-5 text-slate-400 ml-1" />
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-9 w-36 rounded-xl border-slate-200 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-9 w-28 rounded-xl border-slate-200 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 pr-1">{MONTH_NAMES[month - 1]} {year}</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-white border border-slate-200 shadow-sm rounded-2xl p-1 gap-1 h-auto flex-wrap">
          <TabsTrigger value="lancamentos" className="rounded-xl text-xs font-semibold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Receipt className="w-3.5 h-3.5 mr-1.5" /> Lançamentos
          </TabsTrigger>
          <TabsTrigger value="custos" className="rounded-xl text-xs font-semibold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Custo por Procedimento
          </TabsTrigger>
          <TabsTrigger value="orcado" className="rounded-xl text-xs font-semibold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Target className="w-3.5 h-3.5 mr-1.5" /> Orçado vs Realizado
          </TabsTrigger>
          <TabsTrigger value="dre" className="rounded-xl text-xs font-semibold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> DRE Mensal
          </TabsTrigger>
          <TabsTrigger value="despesas-fixas" className="rounded-xl text-xs font-semibold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Despesas Fixas
          </TabsTrigger>
        </TabsList>

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
// TAB 1: LANÇAMENTOS (existing functionality preserved)
// ═══════════════════════════════════════════════════════════════════════════════

function LancamentosTab({ month, year }: { month: number; year: number }) {
  const [typeFilter, setTypeFilter] = useState<"all" | "receita" | "despesa">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string; amount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [billingRunning, setBillingRunning] = useState(false);
  const [billingResult, setBillingResult] = useState<{ generated: number; recordIds: number[] } | null>(null);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useGetFinancialDashboard({ month, year });
  const { data: rawRecords, isLoading: recLoading, refetch: refetchRec } = useListFinancialRecords({ month, year });

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
        if (data.generated > 0) { toast({ title: `${data.generated} lançamento(s) gerado(s).` }); refetchDash(); refetchRec(); }
        else toast({ title: "Nenhuma assinatura com vencimento hoje." });
      }
    } catch { toast({ variant: "destructive", title: "Erro ao executar cobrança mensal." }); }
    finally { setBillingRunning(false); setShowBillingConfirm(false); }
  };

  return (
    <div>
      {/* Billing trigger */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5">
          <div className="p-1.5 rounded-lg bg-violet-100"><CalendarCheck2 className="w-4 h-4 text-violet-600" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-violet-800">Cobrança Mensal</p>
            <p className="text-[11px] text-violet-600 leading-tight">Gera lançamentos das assinaturas com vencimento hoje</p>
          </div>
          {billingResult !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${billingResult.generated > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {billingResult.generated > 0 ? `${billingResult.generated} gerado(s)` : "Nenhum hoje"}
            </span>
          )}
          <Button size="sm" variant="outline" className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-100 shrink-0 h-8 text-xs font-semibold"
            onClick={() => setShowBillingConfirm(true)} disabled={billingRunning}>
            {billingRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Executar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <KpiCard label="Receitas" value={formatCurrency(dashboard?.monthlyRevenue ?? 0)} icon={<TrendingUp className="w-6 h-6" />} iconBg="bg-green-100 text-green-600" accent="bg-green-50" loading={dashLoading} />
        <KpiCard label="Despesas" value={formatCurrency(dashboard?.monthlyExpenses ?? 0)} icon={<TrendingDown className="w-6 h-6" />} iconBg="bg-red-100 text-red-600" accent="bg-red-50" loading={dashLoading} />
        <KpiCard label="Lucro Líquido" value={formatCurrency(dashboard?.monthlyProfit ?? 0)} icon={<DollarSign className="w-6 h-6" />} iconBg="bg-primary/10 text-primary" accent="bg-primary/5" highlight loading={dashLoading} />
        <KpiCard label="Ticket Médio" value={formatCurrency(dashboard?.averageTicket ?? 0)} icon={<Ticket className="w-6 h-6" />} iconBg="bg-violet-100 text-violet-600" accent="bg-violet-50" loading={dashLoading} />
        <KpiCard label="Consultas" value={`${dashboard?.completedAppointments ?? 0} / ${dashboard?.totalAppointments ?? 0}`} icon={<Stethoscope className="w-6 h-6" />} iconBg="bg-cyan-100 text-cyan-600" accent="bg-cyan-50" loading={dashLoading} sub={dashboard?.topProcedure ? `Top: ${dashboard.topProcedure}` : undefined} />
      </div>

      {/* Subscription Metrics */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Repeat className="w-3.5 h-3.5" /> Receita Recorrente (Assinaturas)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="MRR — Receita Mensal Recorrente" value={formatCurrency((dashboard as any)?.mrr ?? 0)} icon={<Repeat className="w-6 h-6" />} iconBg="bg-indigo-100 text-indigo-600" accent="bg-indigo-50" loading={dashLoading} sub={`${(dashboard as any)?.activeSubscriptions ?? 0} assinatura(s) ativa(s)`} />
          <KpiCard label="A Receber — Cobranças Pendentes" value={formatCurrency((dashboard as any)?.pendingSubscriptionCharges?.total ?? 0)} icon={<Clock className="w-6 h-6" />} iconBg="bg-amber-100 text-amber-600" accent="bg-amber-50" loading={dashLoading} sub={`${(dashboard as any)?.pendingSubscriptionCharges?.count ?? 0} lançamento(s)`} />
          <Card className="border-none shadow-md bg-white col-span-1">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cobertura do MRR</p>
              {dashLoading ? <div className="h-7 w-24 bg-slate-200 animate-pulse rounded" /> : (() => {
                const mrr = (dashboard as any)?.mrr ?? 0;
                const revenue = dashboard?.monthlyRevenue ?? 0;
                const pct = revenue > 0 ? Math.min(100, Math.round((mrr / revenue) * 100)) : (mrr > 0 ? 100 : 0);
                return (<>
                  <p className="text-xl font-bold text-slate-800">{pct}%</p>
                  <p className="text-[10px] text-slate-400 mt-1">do total de receitas é recorrente</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} /></div>
                </>);
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts + Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {pieData.length > 0 && (
          <Card className="border-none shadow-xl rounded-3xl bg-white xl:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="font-display text-lg font-bold text-slate-800">Receita por Categoria</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((_: any, idx: number) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                  <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className={`border-none shadow-xl rounded-3xl overflow-hidden bg-white ${pieData.length > 0 ? "xl:col-span-2" : "xl:col-span-3"}`}>
          <CardHeader className="pb-0 px-6 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-lg font-bold text-slate-800">Lançamentos</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{records.length} registro(s) • {MONTH_NAMES[month - 1]} {year}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {(["all", "receita", "despesa"] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === t ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                      {t === "all" ? "Todos" : t === "receita" ? "Receitas" : "Despesas"}
                    </button>
                  ))}
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="rounded-xl shadow-lg shadow-primary/20 h-9 px-4 text-sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Novo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {recLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum registro encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Categoria</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                      <th className="py-3 px-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => {
                      const displayDate = (record as any).paymentDate ?? (record as any).dueDate ?? record.createdAt;
                      const recStatus: string = (record as any).status ?? "pago";
                      const statusCfg: Record<string, { label: string; cls: string }> = {
                        pago: { label: "Pago", cls: "bg-green-100 text-green-700" },
                        pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
                        estornado: { label: "Estornado", cls: "bg-red-100 text-red-700" },
                        cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-500" },
                      };
                      const { label: statusLabel, cls: statusCls } = statusCfg[recStatus] ?? { label: recStatus, cls: "bg-slate-100 text-slate-500" };
                      return (
                        <tr key={record.id} className="group hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-5 text-sm text-slate-500 whitespace-nowrap">{format(new Date(displayDate), "dd/MM/yy")}</td>
                          <td className="py-3.5 px-5 text-sm font-medium text-slate-800 max-w-[160px] truncate">{record.description}</td>
                          <td className="py-3.5 px-5 hidden md:table-cell">
                            {(record as any).procedureName ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium"><Link2 className="w-3 h-3" />{(record as any).procedureName}</span>
                            ) : record.category ? (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{record.category}</span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="py-3.5 px-5">
                            <Badge className={`text-[11px] font-semibold ${record.type === "receita" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}>
                              {record.type === "receita" ? "Entrada" : "Saída"}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-5 hidden sm:table-cell">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                          </td>
                          <td className={`py-3.5 px-5 text-sm font-bold text-right whitespace-nowrap ${record.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                            {record.type === "receita" ? "+" : "−"}{formatCurrency(Number(record.amount))}
                          </td>
                          <td className="py-3.5 px-3 w-10">
                            <button onClick={() => setDeleteTarget({ id: record.id, description: record.description, amount: Number(record.amount) })}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition-all">
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
                        <td colSpan={3} className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Totais do período</td>
                        <td colSpan={1} className="py-3 px-5 md:hidden" />
                        <td colSpan={2} className="py-3 px-5 hidden sm:table-cell" />
                        <td className="py-3 px-5 text-right">
                          {typeFilter !== "despesa" && <p className="text-sm font-bold text-green-600">+{formatCurrency(totalReceitas)}</p>}
                          {typeFilter !== "receita" && <p className="text-sm font-bold text-red-600">−{formatCurrency(totalDespesas)}</p>}
                          {typeFilter === "all" && <p className={`text-sm font-extrabold mt-0.5 ${totalReceitas - totalDespesas >= 0 ? "text-primary" : "text-red-700"}`}>{formatCurrency(totalReceitas - totalDespesas)}</p>}
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
      </div>

      {/* Modals */}
      <NewRecordModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir Registro</DialogTitle>
            <DialogDescription>Confirmar exclusão de <strong>{deleteTarget?.description}</strong> ({formatCurrency(deleteTarget?.amount ?? 0)})?</DialogDescription>
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
            <DialogDescription>Gera lançamentos financeiros para todas as assinaturas ativas com vencimento hoje. Esta ação é segura e idempotente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBillingConfirm(false)}>Cancelar</Button>
            <Button onClick={handleRunBilling} disabled={billingRunning}>
              {billingRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />} Confirmar
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
    } catch {}
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Despesas Reais (mês)" value={formatCurrency(data?.totalRealOverhead ?? 0)} icon={<TrendingDown className="w-5 h-5" />} iconBg="bg-red-100 text-red-600" />
        <KpiCard label="Despesas Estimadas" value={formatCurrency(data?.totalEstimatedOverhead ?? 0)} icon={<Target className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-600" />
        <KpiCard label="Horas Disponíveis" value={`${data?.totalAvailableHours ?? 0}h`} icon={<Clock className="w-5 h-5" />} iconBg="bg-blue-100 text-blue-600" />
        <KpiCard label="Custo/Hora Real" value={formatCurrency(data?.realCostPerHour ?? 0)} icon={<Activity className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-600" sub={`Estimado: ${formatCurrency(data?.estCostPerHour ?? 0)}/h`} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Preço vs Custo por Procedimento</CardTitle>
            <p className="text-xs text-slate-400">Comparação de preço de venda com custo estimado e custo real rateado</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
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
      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-800">Análise Detalhada por Procedimento</CardTitle>
          <p className="text-xs text-slate-400">{MONTH_NAMES[month - 1]} {year} • Margem = Preço − Custo Direto − Overhead Rateado</p>
        </CardHeader>
        <CardContent className="p-0">
          {!hasData ? (
            <div className="p-12 text-center text-slate-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum procedimento encontrado</p>
              <p className="text-xs mt-1">Cadastre procedimentos para ver a análise de custos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedimento</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Preço</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Custo Direto</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Overhead Est.</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Custo Total Est.</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden lg:table-cell">Custo Real</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Margem Est.</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden lg:table-cell">Margem Real</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Sessões</th>
                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procedures.map((p: any) => {
                    const marginOk = p.estimatedMarginPct >= 30;
                    const marginWarn = p.estimatedMarginPct >= 10 && p.estimatedMarginPct < 30;
                    return (
                      <tr key={p.procedureId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{p.category} • {p.durationMinutes}min</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-slate-800 text-right">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 text-right">{formatCurrency(p.estimatedDirectCost)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 text-right hidden md:table-cell">{formatCurrency(p.estimatedOverheadPerSession)}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-amber-700 text-right">{formatCurrency(p.estimatedTotalCostPerSession)}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-red-600 text-right hidden lg:table-cell">{formatCurrency(p.realTotalCostPerSession)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`text-sm font-bold ${marginOk ? "text-green-600" : marginWarn ? "text-amber-600" : "text-red-600"}`}>
                              {formatCurrency(p.estimatedMarginPerSession)}
                            </span>
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${marginOk ? "bg-green-100 text-green-700" : marginWarn ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.estimatedMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right hidden lg:table-cell">
                          <div className="flex flex-col items-end">
                            <span className={`text-sm font-bold ${p.realMarginPerSession >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(p.realMarginPerSession)}
                            </span>
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${p.realMarginPct >= 30 ? "bg-green-100 text-green-700" : p.realMarginPct >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.realMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-center hidden md:table-cell">
                          <span className="text-slate-600 font-medium">{p.completedSessions}</span>
                          <span className="text-slate-300 text-xs"> /{p.scheduledSessions}</span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-green-600 text-right hidden md:table-cell">{p.revenueGenerated > 0 ? formatCurrency(p.revenueGenerated) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
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
    } catch {}
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
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Despesas fixas não configuradas</p>
            <p className="text-amber-600 text-xs mt-0.5">Configure suas despesas fixas recorrentes na aba "Despesas Fixas" para obter estimativas precisas de orçamento.</p>
          </div>
        </div>
      )}

      {/* Revenue comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><TrendingUp className="w-4 h-4 text-green-600" /></div>
              Receitas — Orçado vs Realizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Estimado</p>
                <p className="text-2xl font-bold text-slate-300">{formatCurrency(est.revenue ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Realizado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(cur.grossRevenue ?? 0)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Execução</span><span>{revPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${revPct >= 100 ? "bg-green-500" : revPct >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.min(100, revPct)}%` }} />
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-3 py-2 ${variance.revenue >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {variance.revenue >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {variance.revenue >= 0 ? "+" : ""}{formatCurrency(variance.revenue ?? 0)}
              <span className="font-normal text-xs">({variance.revenuePct?.toFixed(1) ?? 0}% vs estimado)</span>
            </div>
            {est.mrr > 0 && (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                <span className="font-semibold text-slate-600">MRR:</span> {formatCurrency(est.mrr)} •&nbsp;
                <span className="font-semibold text-slate-600">A Receber:</span> {formatCurrency(est.pendingReceivable)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-red-100 rounded-lg"><TrendingDown className="w-4 h-4 text-red-600" /></div>
              Despesas — Orçado vs Realizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Estimado</p>
                <p className="text-2xl font-bold text-slate-300">{formatCurrency(est.expenses ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Realizado</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(cur.totalExpenses ?? 0)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Execução</span><span>{expPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${expPct <= 80 ? "bg-green-500" : expPct <= 100 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${Math.min(100, expPct)}%` }} />
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-3 py-2 ${variance.expenses <= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {variance.expenses <= 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              {variance.expenses >= 0 ? "+" : ""}{formatCurrency(variance.expenses ?? 0)}
              <span className="font-normal text-xs">({variance.expensesPct?.toFixed(1) ?? 0}% vs estimado)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Profit Comparison */}
      <Card className="border-none shadow-xl rounded-3xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg"><DollarSign className="w-4 h-4 text-primary" /></div>
            Resultado Líquido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center bg-slate-50 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Estimado</p>
              <p className={`text-2xl font-bold ${(est.netProfit ?? 0) >= 0 ? "text-slate-600" : "text-red-500"}`}>{formatCurrency(est.netProfit ?? 0)}</p>
            </div>
            <div className="text-center bg-primary/5 rounded-2xl p-5 border-2 border-primary/20">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Realizado</p>
              <p className={`text-2xl font-bold ${(cur.netProfit ?? 0) >= 0 ? "text-primary" : "text-red-600"}`}>{formatCurrency(cur.netProfit ?? 0)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Margem: {cur.netMarginPct?.toFixed(1) ?? 0}%</p>
            </div>
            <div className="text-center bg-slate-50 rounded-2xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Mês Anterior</p>
              <p className={`text-2xl font-bold ${(data?.previous?.netProfit ?? 0) >= 0 ? "text-slate-600" : "text-red-500"}`}>{formatCurrency(data?.previous?.netProfit ?? 0)}</p>
              {variance.netProfitChangeVsPrevMonth !== 0 && (
                <p className={`text-[11px] font-semibold mt-1 ${variance.netProfitChangeVsPrevMonth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {variance.netProfitChangeVsPrevMonth >= 0 ? "+" : ""}{variance.netProfitChangeVsPrevMonth?.toFixed(1)}% vs anterior
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense breakdown */}
      {(cur.expensesByCategory ?? []).length > 0 && (
        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Despesas Realizadas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cur.expensesByCategory.map((cat: any) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <p className="text-sm text-slate-600 w-36 shrink-0 truncate">{cat.category}</p>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${cat.pct}%` }} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 w-24 text-right shrink-0">{formatCurrency(cat.amount)}</p>
                  <p className="text-xs text-slate-400 w-10 text-right shrink-0">{cat.pct.toFixed(0)}%</p>
                </div>
              ))}
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
    } catch {}
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const cur = data?.current ?? {};
  const prev = data?.previous ?? {};
  const est = data?.estimated ?? {};
  const variance = data?.variance ?? {};

  function ChangeChip({ value, inverted }: { value: number; inverted?: boolean }) {
    const positive = inverted ? value <= 0 : value >= 0;
    if (value === 0) return <span className="text-[11px] text-slate-400 font-medium">–</span>;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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
      <tr className={`border-b border-slate-100 ${isTotal ? "bg-primary/5 font-extrabold" : isSubtotal ? "bg-slate-50 font-bold" : "hover:bg-slate-50/60"}`}>
        <td className={`py-3 px-5 text-sm ${indent ? "pl-10 text-slate-500" : isTotal ? "text-slate-900" : isSubtotal ? "text-slate-700" : "text-slate-600"}`}>
          {label}
        </td>
        {estimated !== undefined && (
          <td className="py-3 px-4 text-sm text-right text-slate-400">{formatCurrency(estimated)}</td>
        )}
        {previous !== undefined && (
          <td className="py-3 px-4 text-sm text-right text-slate-400">{formatCurrency(previous)}</td>
        )}
        <td className={`py-3 px-5 text-sm text-right font-semibold ${isTotal ? (current >= 0 ? "text-primary" : "text-red-600") : isNegative ? "text-red-600" : current < 0 ? "text-red-600" : "text-slate-800"}`}>
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
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${executionPct >= 90 ? "bg-green-500" : executionPct >= 60 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.min(100, executionPct)}%` }} />
              </div>
              <span className="text-[11px] text-slate-400">{executionPct.toFixed(0)}%</span>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Receita Bruta" value={formatCurrency(cur.grossRevenue ?? 0)} icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-green-100 text-green-600" trend={hasPrev && prev.grossRevenue ? { value: ((cur.grossRevenue - prev.grossRevenue) / Math.abs(prev.grossRevenue)) * 100 } : undefined} />
        <KpiCard label="Total Despesas" value={formatCurrency(cur.totalExpenses ?? 0)} icon={<TrendingDown className="w-5 h-5" />} iconBg="bg-red-100 text-red-600" trend={hasPrev && prev.totalExpenses ? { value: ((cur.totalExpenses - prev.totalExpenses) / Math.abs(prev.totalExpenses)) * 100 } : undefined} />
        <KpiCard label="Resultado Líquido" value={formatCurrency(cur.netProfit ?? 0)} icon={<DollarSign className="w-5 h-5" />} iconBg="bg-primary/10 text-primary" highlight trend={variance.netProfitChangeVsPrevMonth ? { value: variance.netProfitChangeVsPrevMonth } : undefined} />
        <KpiCard label="Margem Líquida" value={`${cur.netMarginPct?.toFixed(1) ?? 0}%`} icon={<PiggyBank className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-600" sub={`Meta: ≥ 20%`} />
      </div>

      {/* DRE Table */}
      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-slate-800">Demonstrativo de Resultado</CardTitle>
          <p className="text-xs text-slate-400">{MONTH_NAMES[month - 1]} {year}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  {hasEstimated && <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Orçado</th>}
                  {hasPrev && <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Mês Ant.</th>}
                  <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Realizado</th>
                  {hasPrev && <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Variação</th>}
                  {hasEstimated && <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Execução</th>}
                </tr>
              </thead>
              <tbody>
                <DreRow label="(+) Receita Bruta" current={cur.grossRevenue ?? 0} previous={hasPrev ? prev.grossRevenue : undefined} estimated={hasEstimated ? est.revenue : undefined} isSubtotal />

                {(cur.expensesByCategory ?? []).map((cat: any) => (
                  <DreRow key={cat.category} label={cat.category} current={cat.amount} indent isNegative />
                ))}

                {(cur.expensesByCategory ?? []).length > 0 && (
                  <DreRow label="(−) Total Despesas" current={cur.totalExpenses ?? 0} previous={hasPrev ? prev.totalExpenses : undefined} estimated={hasEstimated ? est.expenses : undefined} isSubtotal isNegative />
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

          {/* Margin row */}
          <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-200">
            {hasEstimated && (
              <div className="bg-white py-3 px-5 text-center">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider">Margem Estimada</p>
                <p className="text-base font-bold text-slate-500 mt-0.5">{est.revenue > 0 ? ((est.netProfit / est.revenue) * 100).toFixed(1) : 0}%</p>
              </div>
            )}
            {hasPrev && (
              <div className="bg-white py-3 px-5 text-center">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider">Margem Anterior</p>
                <p className="text-base font-bold text-slate-500 mt-0.5">{prev.netMarginPct?.toFixed(1) ?? 0}%</p>
              </div>
            )}
            <div className={`py-3 px-5 text-center ${(cur.netMarginPct ?? 0) >= 20 ? "bg-green-50" : (cur.netMarginPct ?? 0) >= 10 ? "bg-amber-50" : "bg-red-50"}`}>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Margem Realizada</p>
              <p className={`text-base font-bold mt-0.5 ${(cur.netMarginPct ?? 0) >= 20 ? "text-green-700" : (cur.netMarginPct ?? 0) >= 10 ? "text-amber-700" : "text-red-700"}`}>
                {cur.netMarginPct?.toFixed(1) ?? 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recurring expenses breakdown */}
      {(data?.recurringExpenses ?? []).length > 0 && (
        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-500" /> Despesas Fixas Configuradas
            </CardTitle>
            <p className="text-xs text-slate-400">Base para o orçamento estimado de despesas</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recurringExpenses.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.category} • {r.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatCurrency(r.amount)}</p>
                    {r.frequency !== "mensal" && <p className="text-[11px] text-slate-400">≈ {formatCurrency(r.monthlyEquivalent)}/mês</p>}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between font-bold text-sm pt-2">
                <span className="text-slate-700">Total Mensal Estimado</span>
                <span className="text-red-600">{formatCurrency(est.expenses ?? 0)}</span>
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
    } catch {}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Despesas Fixas Recorrentes</h2>
          <p className="text-sm text-slate-500">Configure suas despesas fixas para calcular o orçamento estimado e o custo por hora clínico.</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setIsModalOpen(true); }} className="rounded-xl shadow-lg shadow-primary/20 h-9 px-4">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Despesa
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Mensal Estimado" value={formatCurrency(totalMonthly)} icon={<Receipt className="w-5 h-5" />} iconBg="bg-red-100 text-red-600" accent="bg-red-50" />
        <KpiCard label="Despesas Cadastradas" value={String(records.length)} icon={<Settings2 className="w-5 h-5" />} iconBg="bg-slate-100 text-slate-600" sub={`${records.filter(r => r.isActive).length} ativa(s)`} />
        <KpiCard label="Total Anual Estimado" value={formatCurrency(totalMonthly * 12)} icon={<CalendarDays className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-600" accent="bg-violet-50" />
        <KpiCard label="Categorias" value={String(Object.keys(categoryGroups).length)} icon={<BarChart3 className="w-5 h-5" />} iconBg="bg-blue-100 text-blue-600" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : records.length === 0 ? (
        <Card className="border-none shadow-md rounded-3xl bg-white">
          <CardContent className="p-12 text-center">
            <PiggyBank className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-600">Nenhuma despesa fixa cadastrada</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Adicione aluguel, salários, contas e outros custos fixos para habilitar o cálculo de custo por procedimento e o orçamento estimado.</p>
            <Button onClick={() => { setEditTarget(null); setIsModalOpen(true); }} variant="outline" className="rounded-xl">
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar primeira despesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(categoryGroups).map(([cat, items]) => (
            <Card key={cat} className="border-none shadow-md rounded-2xl bg-white overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</p>
                <p className="text-xs font-semibold text-slate-400">
                  {formatCurrency(items.filter((r: any) => r.isActive).reduce((s: number, r: any) => {
                    const a = Number(r.amount);
                    return s + (r.frequency === "anual" ? a / 12 : r.frequency === "semanal" ? a * 4.33 : a);
                  }, 0))}/mês
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map((r: any) => (
                  <div key={r.id} className={`flex items-center gap-4 px-5 py-3.5 ${!r.isActive ? "opacity-50" : ""}`}>
                    <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${r.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>{r.name}</p>
                      {r.notes && <p className="text-[11px] text-slate-400 truncate">{r.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(Number(r.amount))}</p>
                      <p className="text-[11px] text-slate-400">{freqLabel[r.frequency] ?? r.frequency}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditTarget(r); setIsModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Add/Edit */}
      <RecurringExpenseModal
        open={isModalOpen}
        editData={editTarget}
        onClose={() => { setIsModalOpen(false); setEditTarget(null); }}
        onSuccess={() => { setIsModalOpen(false); setEditTarget(null); fetchRecords(); }}
      />

      {/* Modal: Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Remover Despesa Fixa</DialogTitle>
            <DialogDescription>Confirmar remoção de <strong>{deleteTarget?.name}</strong>? Isso não afetará registros financeiros já gerados.</DialogDescription>
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
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
              Equivalente mensal: <strong className="text-slate-600">{formatCurrency(Number(amount) / 12)}</strong>
            </p>
          )}
          {amount && frequency === "semanal" && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
              Equivalente mensal: <strong className="text-slate-600">{formatCurrency(Number(amount) * 4.33)}</strong>
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

// ─── Modal: New Financial Record (preserved from original) ───────────────────

function NewRecordModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<"receita" | "despesa">("despesa");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const createRecord = useCreateFinancialRecord();

  const categories = type === "receita" ? REVENUE_CATEGORIES : [...GENERAL_EXPENSE_CATEGORIES];

  useEffect(() => {
    if (!open) { setAmount(""); setDescription(""); setCategory(""); setType("despesa"); }
  }, [open]);

  const handleSubmit = async () => {
    if (!amount || !description) {
      toast({ variant: "destructive", title: "Preencha valor e descrição." }); return;
    }
    setSaving(true);
    try {
      await createRecord.mutateAsync({ type, amount: String(Number(amount)), description, category: category || undefined } as any);
      toast({ title: "Registro criado com sucesso!" });
      onSuccess();
    } catch { toast({ variant: "destructive", title: "Erro ao criar registro." }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa manualmente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {(["receita", "despesa"] as const).map(t => (
              <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${type === t ? (t === "receita" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500") : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$) *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o lançamento…" className="rounded-xl" />
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
