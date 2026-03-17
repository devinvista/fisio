import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface MonthlyRevenue {
  month: number;
  monthName: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ProcedureRevenue {
  procedureId: number;
  procedureName: string;
  category: string;
  totalRevenue: number;
  totalSessions: number;
  averageTicket: number;
}

interface ScheduleOccupation {
  totalSlots: number;
  occupiedSlots: number;
  occupationRate: number;
  canceledCount: number;
  noShowCount: number;
  byDayOfWeek: { dayOfWeek: string; count: number }[];
}

export default function Relatorios() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));

  const { data: monthlyRevenueRaw } = useQuery<MonthlyRevenue[]>({
    queryKey: ["reports-monthly-revenue", selectedYear],
    queryFn: () => fetch(`/api/reports/monthly-revenue?year=${selectedYear}`).then(r => r.json()),
  });
  const monthlyRevenue: MonthlyRevenue[] = Array.isArray(monthlyRevenueRaw) ? monthlyRevenueRaw : [];

  const { data: procedureRevenueRaw } = useQuery<ProcedureRevenue[]>({
    queryKey: ["reports-procedure-revenue", selectedMonth, selectedYear],
    queryFn: () => fetch(`/api/reports/procedure-revenue?month=${selectedMonth}&year=${selectedYear}`).then(r => r.json()),
  });
  const procedureRevenue: ProcedureRevenue[] = Array.isArray(procedureRevenueRaw) ? procedureRevenueRaw : [];

  const { data: scheduleOccupation } = useQuery<ScheduleOccupation>({
    queryKey: ["reports-schedule-occupation", selectedMonth, selectedYear],
    queryFn: () => fetch(`/api/reports/schedule-occupation?month=${selectedMonth}&year=${selectedYear}`).then(r => r.json()),
  });

  return (
    <AppLayout title="Relatórios">
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análises e indicadores da clínica</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="space-y-1 w-40">
            <Label>Ano</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-48">
            <Label>Mês</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Faturamento Mensal — {selectedYear}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyRevenue} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="monthName" tick={{ fontSize: 11 }} tickFormatter={v => v.substring(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Despesas" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Schedule Occupation */}
        {scheduleOccupation && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Ocupação da Agenda — {MONTH_NAMES[parseInt(selectedMonth) - 1]}/{selectedYear}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{scheduleOccupation.occupationRate.toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground mt-1">Taxa de Ocupação</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{scheduleOccupation.totalSlots}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Agendamentos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-destructive">{scheduleOccupation.canceledCount}</div>
                <div className="text-sm text-muted-foreground mt-1">Cancelamentos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{scheduleOccupation.noShowCount}</div>
                <div className="text-sm text-muted-foreground mt-1">Faltas</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Atendimentos por Dia da Semana</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scheduleOccupation.byDayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dayOfWeek" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Atendimentos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Procedure Revenue Table */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Receita por Procedimento — {MONTH_NAMES[parseInt(selectedMonth) - 1]}/{selectedYear}</h2>
          {procedureRevenue.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados para o período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Procedimento</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Categoria</th>
                    <th className="text-right py-3 pr-4 font-medium text-muted-foreground">Sessões</th>
                    <th className="text-right py-3 pr-4 font-medium text-muted-foreground">Ticket Médio</th>
                    <th className="text-right py-3 font-medium text-muted-foreground">Receita Total</th>
                  </tr>
                </thead>
                <tbody>
                  {procedureRevenue.filter(p => Number(p.totalSessions) > 0).map((p) => (
                    <tr key={p.procedureId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{p.procedureName}</td>
                      <td className="py-3 pr-4 text-muted-foreground capitalize">{p.category}</td>
                      <td className="py-3 pr-4 text-right">{p.totalSessions}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(p.averageTicket)}</td>
                      <td className="py-3 text-right font-semibold text-primary">{formatCurrency(p.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
