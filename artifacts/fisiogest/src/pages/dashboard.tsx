import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  HeartHandshake,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Clock,
  CalendarCheck,
  Dumbbell,
  Percent,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogoMark } from "@/components/logo-mark";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-11 h-11 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium text-sm">Carregando seus dados…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const STATUS_LABELS: Record<string, string> = {
    agendado:   "Agendado",
    confirmado: "Confirmado",
    concluido:  "Concluído",
    cancelado:  "Cancelado",
    faltou:     "Faltou",
  };
  const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

  const todayFmt = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppLayout title="Dashboard">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-teal-700 text-white p-6 mb-8 shadow-xl shadow-primary/20">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium capitalize">{todayFmt}</p>
            <h2 className="font-display text-2xl font-bold mt-0.5">Bem-vindo à sua clínica</h2>
            <p className="text-white/70 text-sm mt-1 max-w-md">
              {data?.todayTotal
                ? `Você tem ${data.todayTotal} atendimento${data.todayTotal !== 1 ? "s" : ""} agendado${data.todayTotal !== 1 ? "s" : ""} hoje.`
                : "Sua agenda de hoje está livre."}
            </p>
          </div>
          <LogoMark size={72} withBackground={false} className="text-white/20 shrink-0 hidden sm:block" />
        </div>
        {/* decorative circle */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -top-8 -left-8 w-36 h-36 rounded-full bg-white/5" />
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">

        {/* Receita */}
        <Card className="border-none shadow-md bg-gradient-to-br from-primary to-teal-700 text-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Receita do Mês</p>
                <h3 className="font-display text-2xl font-bold">{formatCurrency(data?.monthlyRevenue || 0)}</h3>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-white/80 gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Em dia com as metas</span>
            </div>
          </CardContent>
        </Card>

        {/* Pacientes */}
        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Pacientes</p>
                <h3 className="font-display text-2xl font-bold text-foreground">{data?.totalPatients || 0}</h3>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <HeartHandshake className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-muted-foreground gap-1.5">
              <span>Pacientes ativos na clínica</span>
            </div>
          </CardContent>
        </Card>

        {/* Atendimentos hoje */}
        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Atend. Hoje</p>
                <h3 className="font-display text-2xl font-bold text-foreground">{data?.todayTotal || 0}</h3>
              </div>
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-muted-foreground gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-teal-500" />
              <span>Sessões agendadas</span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Ocupação */}
        <Card className="border-none shadow-md bg-white hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Ocupação</p>
                <h3 className="font-display text-2xl font-bold text-foreground">{(data?.occupationRate || 0).toFixed(1)}%</h3>
              </div>
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(data?.occupationRate || 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Appointment lists ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today */}
        <Card className="border-none shadow-md">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Agenda de Hoje</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Seus próximos pacientes</p>
            </div>
            <div className="p-2 bg-teal-50 rounded-lg">
              <Clock className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <CardContent className="p-0">
            {data?.todayAppointments && data.todayAppointments.length > 0 ? (
              <div className="divide-y divide-border">
                {data.todayAppointments.map((apt) => (
                  <div key={apt.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center bg-primary/8 border border-primary/15 rounded-xl w-14 h-14 shrink-0">
                        <span className="text-sm font-bold text-primary leading-none">{apt.startTime}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{apt.patient?.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Dumbbell className="w-3 h-3 text-primary/60" />
                          {apt.procedure?.name}
                        </p>
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border status-${apt.status}`}>
                      {statusLabel(apt.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="bg-teal-50 p-4 rounded-2xl mb-3">
                  <CalendarCheck className="w-7 h-7 text-teal-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-600">Agenda livre hoje</h4>
                <p className="text-xs text-slate-400 mt-1">Nenhuma sessão para hoje.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="border-none shadow-md">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Próximos Atendimentos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Visão geral dos próximos dias</p>
            </div>
            <div className="p-2 bg-violet-50 rounded-lg">
              <CalendarCheck className="w-4 h-4 text-violet-500" />
            </div>
          </div>
          <CardContent className="p-0">
            {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
              <div className="divide-y divide-border">
                {data.upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold bg-primary/8 text-primary px-2 py-0.5 rounded-md border border-primary/15">
                          {format(new Date(apt.date), "dd/MM (EEE)", { locale: ptBR })}
                        </span>
                        <span className="text-xs font-bold text-slate-600">{apt.startTime}</span>
                      </div>
                      <p className="font-semibold text-foreground text-sm">{apt.patient?.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Dumbbell className="w-3 h-3 text-primary/60" />
                        {apt.procedure?.name}
                      </p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border status-${apt.status}`}>
                      {statusLabel(apt.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="bg-violet-50 p-4 rounded-2xl mb-3">
                  <CalendarCheck className="w-7 h-7 text-violet-300" />
                </div>
                <h4 className="text-sm font-semibold text-slate-600">Agenda livre</h4>
                <p className="text-xs text-slate-400 mt-1">Nenhum agendamento futuro.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
