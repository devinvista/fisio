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
  RefreshCw, CalendarCheck2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#14b8a6"];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - i);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Financial() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState<"all" | "receita" | "despesa">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string; amount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [billingRunning, setBillingRunning] = useState(false);
  const [billingResult, setBillingResult] = useState<{ generated: number; recordIds: number[] } | null>(null);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } =
    useGetFinancialDashboard({ month, year });

  const { data: rawRecords, isLoading: recLoading, refetch: refetchRec } =
    useListFinancialRecords({ month, year });

  const records = useMemo(() => {
    if (!rawRecords) return [];
    const sorted = [...rawRecords].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (typeFilter === "all") return sorted;
    return sorted.filter((r) => r.type === typeFilter);
  }, [rawRecords, typeFilter]);

  const totalReceitas = useMemo(
    () => records.filter((r) => r.type === "receita").reduce((s, r) => s + Number(r.amount), 0),
    [records]
  );
  const totalDespesas = useMemo(
    () => records.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0),
    [records]
  );

  const pieData = useMemo(() => {
    const cats = dashboard?.revenueByCategory ?? [];
    return cats.filter((c: any) => Number(c.revenue) > 0).map((c: any) => ({
      name: c.category === "null" || !c.category ? "Outros" : c.category,
      value: Number(c.revenue),
    }));
  }, [dashboard]);

  const handleSuccess = () => {
    setIsModalOpen(false);
    refetchDash();
    refetchRec();
  };

  const handleDeleteRecord = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/financial/records/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro ao excluir", description: data.message ?? "Não foi possível excluir o registro." });
      } else {
        toast({ title: "Registro excluído com sucesso." });
        setDeleteTarget(null);
        refetchDash();
        refetchRec();
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir registro financeiro." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunBilling = async () => {
    setBillingRunning(true);
    setBillingResult(null);
    try {
      const res = await fetch("/api/subscriptions/run-billing", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erro na cobrança mensal", description: data.message ?? "Verifique e tente novamente." });
      } else {
        setBillingResult(data);
        if (data.generated > 0) {
          toast({ title: `Cobrança executada!`, description: `${data.generated} lançamento(s) gerado(s) com sucesso.` });
          refetchDash();
          refetchRec();
        } else {
          toast({ title: "Cobrança executada", description: "Nenhuma assinatura com vencimento hoje ou já cobradas este mês." });
        }
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao executar cobrança mensal." });
    } finally {
      setBillingRunning(false);
      setShowBillingConfirm(false);
    }
  };

  return (
    <AppLayout title="Controle Financeiro">

      {/* Top action bar: period selector + billing trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200 w-fit">
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
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 pr-1">
          {MONTH_NAMES[month - 1]} {year}
        </span>
      </div>

      {/* Monthly billing trigger */}
      <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <CalendarCheck2 className="w-4 h-4 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-violet-800">Cobrança Mensal</p>
          <p className="text-[11px] text-violet-600 leading-tight">Gera lançamentos das assinaturas com vencimento hoje</p>
        </div>
        {billingResult !== null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${billingResult.generated > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {billingResult.generated > 0 ? `${billingResult.generated} gerado(s)` : "Nenhum hoje"}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-100 shrink-0 h-8 text-xs font-semibold"
          onClick={() => setShowBillingConfirm(true)}
          disabled={billingRunning}
        >
          {billingRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          Executar
        </Button>
      </div>

      </div>{/* end top action bar */}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="Receitas"
          value={formatCurrency(dashboard?.monthlyRevenue ?? 0)}
          icon={<TrendingUp className="w-6 h-6" />}
          iconBg="bg-green-100 text-green-600"
          accent="bg-green-50"
          loading={dashLoading}
        />
        <KpiCard
          label="Despesas"
          value={formatCurrency(dashboard?.monthlyExpenses ?? 0)}
          icon={<TrendingDown className="w-6 h-6" />}
          iconBg="bg-red-100 text-red-600"
          accent="bg-red-50"
          loading={dashLoading}
        />
        <KpiCard
          label="Lucro Líquido"
          value={formatCurrency(dashboard?.monthlyProfit ?? 0)}
          icon={<DollarSign className="w-6 h-6" />}
          iconBg="bg-primary/10 text-primary"
          accent="bg-primary/5"
          highlight
          loading={dashLoading}
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(dashboard?.averageTicket ?? 0)}
          icon={<Ticket className="w-6 h-6" />}
          iconBg="bg-violet-100 text-violet-600"
          accent="bg-violet-50"
          loading={dashLoading}
        />
        <KpiCard
          label="Consultas"
          value={`${dashboard?.completedAppointments ?? 0} / ${dashboard?.totalAppointments ?? 0}`}
          icon={<Stethoscope className="w-6 h-6" />}
          iconBg="bg-cyan-100 text-cyan-600"
          accent="bg-cyan-50"
          loading={dashLoading}
          sub={dashboard?.topProcedure ? `Top: ${dashboard.topProcedure}` : undefined}
        />
      </div>

      {/* Charts + Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Pie chart */}
        {pieData.length > 0 && (
          <Card className="border-none shadow-xl rounded-3xl bg-white xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg font-bold text-slate-800">
                Receita por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Records table */}
        <Card className={`border-none shadow-xl rounded-3xl overflow-hidden bg-white ${pieData.length > 0 ? "xl:col-span-2" : "xl:col-span-3"}`}>
          <CardHeader className="pb-0 px-6 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-lg font-bold text-slate-800">
                  Lançamentos
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {records.length} registro(s) • {MONTH_NAMES[month - 1]} {year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {(["all", "receita", "despesa"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        typeFilter === t
                          ? "bg-white shadow text-slate-800"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {t === "all" ? "Todos" : t === "receita" ? "Receitas" : "Despesas"}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-xl shadow-lg shadow-primary/20 h-9 px-4 text-sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Novo
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 mt-4">
            {recLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum registro encontrado</p>
                <p className="text-xs mt-1">
                  {typeFilter !== "all"
                    ? `Sem ${typeFilter === "receita" ? "receitas" : "despesas"} neste período`
                    : "Adicione um lançamento para começar"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Categoria / Procedimento</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                      <th className="py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => (
                      <tr key={record.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 text-sm text-slate-500 whitespace-nowrap">
                          {format(new Date(record.createdAt), "dd/MM/yy")}
                        </td>
                        <td className="py-3.5 px-5 text-sm font-medium text-slate-800 max-w-[160px] truncate">
                          {record.description}
                        </td>
                        <td className="py-3.5 px-5 hidden md:table-cell">
                          {(record as any).procedureName ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                              <Link2 className="w-3 h-3" />
                              {(record as any).procedureName}
                            </span>
                          ) : record.category ? (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {record.category}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge
                            className={`text-[11px] font-semibold ${
                              record.type === "receita"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : "bg-red-100 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            {record.type === "receita" ? "Entrada" : "Saída"}
                          </Badge>
                        </td>
                        <td className={`py-3.5 px-5 text-sm font-bold text-right whitespace-nowrap ${
                          record.type === "receita" ? "text-green-600" : "text-red-600"
                        }`}>
                          {record.type === "receita" ? "+" : "−"}{formatCurrency(Number(record.amount))}
                        </td>
                        <td className="py-3.5 px-3 w-10">
                          <button
                            onClick={() => setDeleteTarget({ id: record.id, description: record.description, amount: Number(record.amount) })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition-all"
                            title="Excluir registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {records.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={3} className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                          Totais do período
                        </td>
                        <td colSpan={1} className="py-3 px-5 md:hidden" />
                        <td className="py-3 px-5">
                          {typeFilter !== "despesa" && totalReceitas > 0 && (
                            <span className="text-xs font-bold text-green-600 block">
                              +{formatCurrency(totalReceitas)}
                            </span>
                          )}
                          {typeFilter !== "receita" && totalDespesas > 0 && (
                            <span className="text-xs font-bold text-red-600 block">
                              −{formatCurrency(totalDespesas)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <span className={`text-sm font-bold ${
                            totalReceitas - totalDespesas >= 0 ? "text-slate-800" : "text-red-600"
                          }`}>
                            {formatCurrency(totalReceitas - totalDespesas)}
                          </span>
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

      {/* New record modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border-none shadow-2xl rounded-3xl sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Novo Lançamento</DialogTitle>
          </DialogHeader>
          <CreateRecordForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="border-none shadow-2xl rounded-3xl sm:max-w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="font-display text-xl">Excluir Registro?</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 pt-1">
              Esta ação não pode ser desfeita. O registro será permanentemente removido.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm my-1">
              <p className="font-semibold text-slate-800 truncate">{deleteTarget.description}</p>
              <p className="text-slate-500 text-xs mt-0.5">{formatCurrency(deleteTarget.amount)}</p>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleDeleteRecord} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing trigger confirmation dialog */}
      <Dialog open={showBillingConfirm} onOpenChange={setShowBillingConfirm}>
        <DialogContent className="border-none shadow-2xl rounded-3xl sm:max-w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-violet-100">
                <CalendarCheck2 className="w-5 h-5 text-violet-600" />
              </div>
              <DialogTitle className="font-display text-xl">Executar Cobrança Mensal</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 pt-1">
              Serão gerados lançamentos financeiros pendentes para todas as assinaturas ativas cujo dia de vencimento é hoje. Assinaturas já cobradas neste mês serão ignoradas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowBillingConfirm(false)} disabled={billingRunning}>
              Cancelar
            </Button>
            <Button className="rounded-xl bg-violet-600 hover:bg-violet-700" onClick={handleRunBilling} disabled={billingRunning}>
              {billingRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Confirmar e Executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, iconBg, accent, highlight, loading, sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  accent: string;
  highlight?: boolean;
  loading?: boolean;
  sub?: string;
}) {
  return (
    <Card className={`border-none shadow-md hover:shadow-lg transition-all relative overflow-hidden col-span-1 ${highlight ? "bg-primary text-white" : "bg-white"}`}>
      <div className={`absolute top-0 right-0 w-20 h-20 ${highlight ? "bg-white/10" : accent} rounded-full -mr-6 -mt-6 opacity-60`} />
      <CardContent className="p-5 relative z-10">
        <div className={`inline-flex p-2.5 rounded-xl mb-3 ${highlight ? "bg-white/20" : iconBg}`}>
          {icon}
        </div>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${highlight ? "text-white/80" : "text-slate-500"}`}>
          {label}
        </p>
        {loading ? (
          <div className="h-7 w-24 bg-slate-200 animate-pulse rounded" />
        ) : (
          <p className={`text-xl font-bold leading-tight ${highlight ? "text-white" : "text-slate-800"}`}>
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className={`text-[10px] mt-1 truncate ${highlight ? "text-white/70" : "text-slate-400"}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Create Record Form ───────────────────────────────────────────────────────

type ExpenseMode = "geral" | "procedimento";

function CreateRecordForm({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState<"receita" | "despesa">("despesa");
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>("geral");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [procedureId, setProcedureId] = useState<string | undefined>(undefined);

  const mutation = useCreateFinancialRecord();
  const { toast } = useToast();
  const { data: procedures } = useListProcedures();

  const categories = type === "receita"
    ? REVENUE_CATEGORIES
    : expenseMode === "procedimento"
      ? PROCEDURE_EXPENSE_CATEGORIES
      : GENERAL_EXPENSE_CATEGORIES;

  const handleTypeChange = (newType: "receita" | "despesa") => {
    setType(newType);
    setCategory(undefined);
    setProcedureId(undefined);
    setExpenseMode("geral");
  };

  const handleExpenseModeChange = (mode: ExpenseMode) => {
    setExpenseMode(mode);
    setProcedureId(undefined);
    setCategory(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Informe um valor maior que zero." });
      return;
    }
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Descrição obrigatória" });
      return;
    }

    const payload: {
      type: "receita" | "despesa";
      amount: number;
      description: string;
      category?: string;
      procedureId?: number;
    } = {
      type,
      amount: numAmount,
      description: description.trim(),
      category: category || undefined,
      procedureId: (type === "despesa" && expenseMode === "procedimento" && procedureId)
        ? parseInt(procedureId)
        : undefined,
    };

    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Lançamento registrado com sucesso." });
          onSuccess();
        },
        onError: (err: any) => {
          const msg = err?.data?.message ?? "Verifique os dados e tente novamente.";
          toast({ variant: "destructive", title: "Erro ao salvar lançamento.", description: msg });
        },
      }
    );
  };

  const isValid = amount && Number(amount) > 0 && description.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-3">
      {/* Type selector */}
      <div className="grid grid-cols-2 gap-2">
        {(["receita", "despesa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
              type === t
                ? t === "receita"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {t === "receita" ? "↑ Receita (Entrada)" : "↓ Despesa (Saída)"}
          </button>
        ))}
      </div>

      {/* Expense mode toggle — only for despesas */}
      {type === "despesa" && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">Tipo de despesa</Label>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => handleExpenseModeChange("geral")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                expenseMode === "geral"
                  ? "bg-white shadow text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Geral (custo fixo)
            </button>
            <button
              type="button"
              onClick={() => handleExpenseModeChange("procedimento")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                expenseMode === "procedimento"
                  ? "bg-white shadow text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Vinculada a Procedimento
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>

        {/* Category or Procedure */}
        {type === "despesa" && expenseMode === "procedimento" ? (
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Procedimento</Label>
            <Select
              value={procedureId ?? ""}
              onValueChange={(v) => setProcedureId(v || undefined)}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {(procedures ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Categoria</Label>
            <Select
              value={category ?? ""}
              onValueChange={(v) => setCategory(v || undefined)}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Procedure mode — show category of the direct cost */}
      {type === "despesa" && expenseMode === "procedimento" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Tipo de insumo / custo direto</Label>
          <Select
            value={category ?? ""}
            onValueChange={(v) => setCategory(v || undefined)}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecionar tipo..." />
            </SelectTrigger>
            <SelectContent>
              {PROCEDURE_EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Descrição</Label>
        <Input
          required
          placeholder={
            type === "receita"
              ? "Ex: Pacote de 10 sessões"
              : expenseMode === "procedimento"
                ? "Ex: Esfoliante e máscara facial"
                : "Ex: Conta de Luz — Março"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <Button
        type="submit"
        className={`w-full h-12 rounded-xl text-base font-semibold shadow-lg mt-2 ${
          type === "receita"
            ? "bg-green-600 hover:bg-green-700 shadow-green-200"
            : "bg-primary shadow-primary/20"
        }`}
        disabled={mutation.isPending || !isValid}
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin w-5 h-5" />
        ) : (
          `Registrar ${type === "receita" ? "Receita" : "Despesa"}`
        )}
      </Button>
    </form>
  );
}
