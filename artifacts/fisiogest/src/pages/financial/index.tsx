import { AppLayout } from "@/components/layout/app-layout";
import { useGetFinancialDashboard, useListFinancialRecords, useCreateFinancialRecord } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Loader2,
  Ticket, Stethoscope, CalendarDays, Filter, ArrowDownUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EXPENSE_CATEGORIES = [
  "Aluguel", "Água e Luz", "Internet", "Material de Escritório",
  "Equipamentos", "Marketing", "Salários", "Impostos", "Manutenção",
  "Outros",
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

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } =
    useGetFinancialDashboard({ month, year });

  const { data: rawRecords, isLoading: recLoading, refetch: refetchRec } =
    useListFinancialRecords({ month, year });

  // Sort descending and filter by type
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

  // Pie chart data from dashboard
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

  return (
    <AppLayout title="Controle Financeiro">

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 mb-8 bg-white rounded-2xl p-3 shadow-sm border border-slate-200 w-fit">
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
                {/* Type filter */}
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
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 text-sm text-slate-500 whitespace-nowrap">
                          {format(new Date(record.createdAt), "dd/MM/yy")}
                        </td>
                        <td className="py-3.5 px-5 text-sm font-medium text-slate-800 max-w-[160px] truncate">
                          {record.description}
                        </td>
                        <td className="py-3.5 px-5 hidden sm:table-cell">
                          {record.category ? (
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
                      </tr>
                    ))}
                  </tbody>

                  {/* Totals footer */}
                  {records.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={3} className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                          Totais do período
                        </td>
                        <td colSpan={1} className="py-3 px-5 sm:hidden" />
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
        <DialogContent className="border-none shadow-2xl rounded-3xl sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Novo Lançamento</DialogTitle>
          </DialogHeader>
          <CreateRecordForm onSuccess={handleSuccess} />
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

function CreateRecordForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    type: "despesa" as "receita" | "despesa",
    amount: "",
    description: "",
    category: "",
  });
  const mutation = useCreateFinancialRecord();
  const { toast } = useToast();

  const categories = formData.type === "receita" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;
    mutation.mutate(
      { data: { ...formData, amount: Number(formData.amount) } },
      {
        onSuccess: () => {
          toast({ title: "Lançamento registrado com sucesso." });
          onSuccess();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao salvar lançamento." }),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-3">
      {/* Type selector */}
      <div className="grid grid-cols-2 gap-2">
        {(["receita", "despesa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFormData({ ...formData, type: t, category: "" })}
            className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
              formData.type === t
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0,00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Categoria</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => setFormData({ ...formData, category: v })}
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
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Descrição</Label>
        <Input
          required
          placeholder={formData.type === "receita" ? "Ex: Pacote de 10 sessões" : "Ex: Conta de Luz — Março"}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="h-11 rounded-xl"
        />
      </div>

      <Button
        type="submit"
        className={`w-full h-12 rounded-xl text-base font-semibold shadow-lg mt-2 ${
          formData.type === "receita"
            ? "bg-green-600 hover:bg-green-700 shadow-green-200"
            : "bg-primary shadow-primary/20"
        }`}
        disabled={mutation.isPending || !formData.amount || !formData.description}
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin w-5 h-5" />
        ) : (
          `Registrar ${formData.type === "receita" ? "Receita" : "Despesa"}`
        )}
      </Button>
    </form>
  );
}
