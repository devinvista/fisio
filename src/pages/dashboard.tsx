import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboard } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, Calendar as CalendarIcon, TrendingUp, Clock, AlertCircle, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium">Carregando seus dados...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const STATUS_LABELS: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    faltou: "Faltou",
  };
  const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

  return (
    <AppLayout title="Dashboard Geral">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 font-medium mb-1">Receita do Mês</p>
                <h3 className="font-display text-3xl font-bold">{formatCurrency(data?.monthlyRevenue || 0)}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-white/90 gap-1">
              <TrendingUp className="w-4 h-4" />
              <span>Em dia com as metas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Total de Pacientes</p>
                <h3 className="font-display text-3xl font-bold text-foreground">{data?.totalPatients || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-muted-foreground gap-1">
              <span>Pacientes ativos na clínica</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Atendimentos Hoje</p>
                <h3 className="font-display text-3xl font-bold text-foreground">{data?.todayTotal || 0}</h3>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <CalendarIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-muted-foreground gap-1">
              <span>Agendados para hoje</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Taxa de Ocupação</p>
                <h3 className="font-display text-3xl font-bold text-foreground">{(data?.occupationRate || 0).toFixed(1)}%</h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(data?.occupationRate || 0, 100)}%` }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-lg">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Agendamentos de Hoje</h3>
              <p className="text-sm text-muted-foreground">Seus próximos pacientes de hoje</p>
            </div>
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <CardContent className="p-0">
            {data?.todayAppointments && data.todayAppointments.length > 0 ? (
              <div className="divide-y divide-border">
                {data.todayAppointments.map((apt) => (
                  <div key={apt.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl w-16 h-16 shrink-0">
                        <span className="text-lg font-bold text-slate-700">{apt.startTime}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-lg">{apt.patient?.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                          {apt.procedure?.name}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border status-${apt.status}`}>
                      {statusLabel(apt.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <CalendarIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-lg font-medium text-slate-700">Nenhum agendamento</h4>
                <p className="text-sm text-slate-500">Você não tem consultas para hoje.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Próximos Agendamentos</h3>
              <p className="text-sm text-muted-foreground">Visão geral dos próximos dias</p>
            </div>
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <CardContent className="p-0">
            {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
              <div className="divide-y divide-border">
                {data.upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {format(new Date(apt.date), "dd/MM (EEE)", { locale: ptBR })}
                        </span>
                        <span className="text-sm font-bold text-slate-700">{apt.startTime}</span>
                      </div>
                      <p className="font-semibold text-foreground">{apt.patient?.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{apt.procedure?.name}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border status-${apt.status}`}>
                      {statusLabel(apt.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <CalendarIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-lg font-medium text-slate-700">Agenda livre</h4>
                <p className="text-sm text-slate-500">Nenhum agendamento futuro encontrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
