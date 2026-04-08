import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, DollarSign, Calendar as CalendarIcon, TrendingUp, Clock,
  AlertCircle, Activity, UserX, Globe, Copy, Check, ExternalLink,
  Cake, Phone, Mail, ArrowUpRight, Target, Plus, CalendarPlus, Stethoscope,
} from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Status badge config (Tailwind-only, no custom CSS) ──────────────────────
const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  agendado:  { dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50",   label: "Agendado"  },
  confirmado:{ dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  label: "Confirmado"},
  concluido: { dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-100", label: "Concluído" },
  cancelado: { dot: "bg-red-400",    text: "text-red-700",    bg: "bg-red-50",    label: "Cancelado" },
  faltou:    { dot: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50", label: "Faltou"    },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, accentColor = "#6366f1", sub, loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor?: string;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: accentColor }} />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
          <div className="p-2 rounded-xl shrink-0 opacity-80" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
            {icon}
          </div>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-lg" />
              <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
              {sub && <div className="mt-1">{sub}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton for appointment cards ──────────────────────────────────────────
function AppointmentSkeleton() {
  return (
    <div className="divide-y divide-slate-50">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 animate-pulse rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-slate-100 animate-pulse rounded" />
            <div className="h-3 w-24 bg-slate-100 animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-slate-100 animate-pulse rounded-full" />
        </div>
      ))}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, isLoading } = useGetDashboard();
  const [copied, setCopied] = useState(false);

  const bookingUrl = `${window.location.origin}${BASE}/agendar`;

  const copyBookingUrl = async () => {
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const d = data as any;
  const occupationRate = data?.occupationRate || 0;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">

        {/* ── Greeting + Quick Actions ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {getGreeting()}{d?.user?.name ? `, ${d.user.name.split(" ")[0]}` : ""}!
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Aqui está o resumo da sua clínica
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agenda">
              <Button className="h-9 px-4 rounded-xl shadow-sm gap-1.5 text-sm" size="sm">
                <CalendarPlus className="w-4 h-4" />
                Novo Agendamento
              </Button>
            </Link>
            <Link href="/pacientes">
              <Button variant="outline" className="h-9 px-4 rounded-xl text-sm gap-1.5" size="sm">
                <Plus className="w-4 h-4" />
                Novo Paciente
              </Button>
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Receita do Mês"
            value={formatCurrency(data?.monthlyRevenue || 0)}
            icon={<DollarSign className="w-4 h-4" />}
            accentColor="#10b981"
            loading={isLoading}
            sub={
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Em dia com as metas
              </span>
            }
          />
          <KpiCard
            label="Pacientes Ativos"
            value={String(data?.totalPatients || 0)}
            icon={<Users className="w-4 h-4" />}
            accentColor="#6366f1"
            loading={isLoading}
            sub={<span className="text-xs text-slate-400">Com plano de tratamento</span>}
          />
          <KpiCard
            label="Atendimentos Hoje"
            value={String(data?.todayTotal || 0)}
            icon={<CalendarIcon className="w-4 h-4" />}
            accentColor="#0ea5e9"
            loading={isLoading}
            sub={<span className="text-xs text-slate-400">Agendados para hoje</span>}
          />
          <KpiCard
            label="Taxa de Ocupação"
            value={`${occupationRate.toFixed(1)}%`}
            icon={<Target className="w-4 h-4" />}
            accentColor={occupationRate >= 80 ? "#10b981" : occupationRate >= 60 ? "#f59e0b" : "#ef4444"}
            loading={isLoading}
            sub={
              !isLoading && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(occupationRate, 100)}%`,
                      backgroundColor: occupationRate >= 80 ? "#10b981" : occupationRate >= 60 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              )
            }
          />
          <KpiCard
            label="Taxa de Faltas"
            value={`${(d?.noShowRate || 0).toFixed(1)}%`}
            icon={<UserX className="w-4 h-4" />}
            accentColor="#f59e0b"
            loading={isLoading}
            sub={
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <AlertCircle className="w-3 h-3 text-orange-400" />
                {d?.noShowCount || 0} falta{(d?.noShowCount || 0) !== 1 ? "s" : ""} no mês
              </span>
            }
          />
        </div>

        {/* ── Online Booking Portal (compact banner) ── */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Portal de Agendamento Online</p>
              <p className="text-xs text-teal-100 truncate hidden sm:block">{bookingUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 rounded-lg gap-1.5 text-xs"
              onClick={copyBookingUrl}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 rounded-lg gap-1.5 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir
              </Button>
            </a>
          </div>
        </div>

        {/* ── Birthday Widget ── */}
        {data?.birthdayPatients && data.birthdayPatients.length > 0 && (
          <Card className="border border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50 shadow-sm rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 flex items-center gap-3 border-b border-pink-100">
              <div className="p-2 bg-pink-100 text-pink-600 rounded-xl">
                <Cake className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Aniversariantes de Hoje</h3>
                <p className="text-xs text-slate-500">
                  {data.birthdayPatients.length === 1
                    ? "1 paciente faz aniversário hoje"
                    : `${data.birthdayPatients.length} pacientes fazem aniversário hoje`}
                </p>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-pink-100">
                {data.birthdayPatients.map((patient) => {
                  const age = patient.birthDate
                    ? differenceInYears(new Date(), parseISO(patient.birthDate))
                    : null;
                  return (
                    <div key={patient.id} className="px-5 py-3 flex items-center justify-between hover:bg-pink-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{patient.name}</p>
                          {age !== null && (
                            <p className="text-xs text-slate-500">{age} anos hoje ✨</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {patient.phone && (
                          <a
                            href={`https://wa.me/55${patient.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-pink-200 text-pink-600 hover:bg-pink-100 rounded-lg">
                              <Phone className="w-3 h-3" />
                            </Button>
                          </a>
                        )}
                        {patient.email && (
                          <a href={`mailto:${patient.email}?subject=Feliz Aniversário!`}>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-pink-200 text-pink-600 hover:bg-pink-100 rounded-lg">
                              <Mail className="w-3 h-3" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Appointment Lists ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Appointments */}
          <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Agendamentos de Hoje</h3>
                <p className="text-xs text-slate-400 mt-0.5">Seus próximos pacientes de hoje</p>
              </div>
              <div className="p-2 bg-sky-50 rounded-xl">
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <AppointmentSkeleton />
              ) : data?.todayAppointments && data.todayAppointments.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {data.todayAppointments.map((apt) => (
                    <div key={apt.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                      {/* Time block */}
                      <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-xl w-12 h-12 shrink-0">
                        <span className="text-sm font-extrabold text-indigo-700 leading-tight">{apt.startTime}</span>
                      </div>

                      {/* Patient + procedure */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 truncate">{apt.patient?.name}</p>
                          {(apt as any).source === "online" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full shrink-0">
                              <Globe className="w-2.5 h-2.5" /> Online
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Stethoscope className="w-3 h-3 text-slate-300 shrink-0" />
                          <p className="text-xs text-slate-400 truncate">{apt.procedure?.name}</p>
                        </div>
                      </div>

                      <StatusBadge status={apt.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                    <CalendarIcon className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">Nenhum agendamento hoje</p>
                  <p className="text-xs text-slate-400 mt-1">Sua agenda está livre por enquanto</p>
                  <Link href="/agenda">
                    <Button size="sm" variant="outline" className="mt-3 h-8 rounded-xl text-xs gap-1.5">
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Criar Agendamento
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Próximos Agendamentos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Visão geral dos próximos dias</p>
              </div>
              <div className="p-2 bg-violet-50 rounded-xl">
                <Activity className="w-4 h-4 text-violet-500" />
              </div>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <AppointmentSkeleton />
              ) : data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {data.upcomingAppointments.map((apt) => (
                    <div key={apt.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                      {/* Date block */}
                      <div className="flex flex-col items-center justify-center bg-violet-50 rounded-xl w-12 h-12 shrink-0">
                        <span className="text-[10px] font-bold text-violet-500 uppercase leading-tight">
                          {format(parseISO(apt.date), "EEE", { locale: ptBR })}
                        </span>
                        <span className="text-lg font-extrabold text-violet-700 leading-tight">
                          {format(parseISO(apt.date), "dd")}
                        </span>
                      </div>

                      {/* Patient + time + procedure */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">{apt.startTime}</span>
                          {(apt as any).source === "online" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                              <Globe className="w-2.5 h-2.5" /> Online
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{apt.patient?.name}</p>
                        <p className="text-xs text-slate-400 truncate">{apt.procedure?.name}</p>
                      </div>

                      <StatusBadge status={apt.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">Agenda livre</p>
                  <p className="text-xs text-slate-400 mt-1">Nenhum agendamento futuro encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}
