import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListAppointments,
  useListPatients,
  useListProcedures,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  useCompleteAppointment,
  type AppointmentWithDetails,
  type UpdateAppointmentRequestStatus,
  type AppointmentStatus,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalIcon,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pencil,
  Trash2,
  User,
  Stethoscope,
  Clock,
  Repeat,
  RefreshCw,
  Lock,
  Ban,
  Users,
  Globe,
  Sparkles,
  History,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { DatePickerPTBR, TimeInputPTBR } from "@/components/ui/date-picker-ptbr";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 19;
const SLOT_HEIGHT = 64; // px per hour
const TOTAL_HOURS = HOUR_END - HOUR_START;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string; badge: string }> = {
  agendado:   { label: "Agendado",   bg: "bg-blue-500",   text: "text-white", dot: "bg-blue-500",   border: "border-blue-600",   badge: "bg-blue-100 text-blue-700" },
  confirmado: { label: "Confirmado", bg: "bg-emerald-500", text: "text-white", dot: "bg-emerald-500", border: "border-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  concluido:  { label: "Concluído",  bg: "bg-slate-400",  text: "text-white", dot: "bg-slate-400",  border: "border-slate-500",  badge: "bg-slate-100 text-slate-600" },
  cancelado:  { label: "Cancelado",  bg: "bg-red-400",    text: "text-white", dot: "bg-red-400",    border: "border-red-500",    badge: "bg-red-100 text-red-700" },
  faltou:     { label: "Faltou",     bg: "bg-orange-400", text: "text-white", dot: "bg-orange-400", border: "border-orange-500", badge: "bg-orange-100 text-orange-700" },
};

type Appointment = AppointmentWithDetails;
type ViewMode = "day" | "fullweek" | "month";

interface BlockedSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTop(minutes: number): number {
  return ((minutes - HOUR_START * 60) / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number): number {
  return (minutes / 60) * SLOT_HEIGHT;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("fullweek");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; procedureId?: number } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const daysCount = view === "day" ? 1 : 6;
  const weekDays = view === "day"
    ? [currentDate]
    : Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const startDateStr = view === "month"
    ? format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : format(weekDays[0], "yyyy-MM-dd");
  const endDateStr = view === "month"
    ? format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : format(weekDays[daysCount - 1], "yyyy-MM-dd");

  const { data: appointments = [], isLoading, refetch } = useListAppointments({ startDate: startDateStr, endDate: endDateStr });

  const { data: blockedSlots = [], refetch: refetchBlocked } = useQuery<BlockedSlot[]>({
    queryKey: ["blocked-slots", startDateStr, endDateStr],
    queryFn: async () => {
      const res = await fetch(`/api/blocked-slots?startDate=${startDateStr}&endDate=${endDateStr}`, { credentials: "include" });
      return res.json();
    },
    staleTime: 30_000,
  });

  const hours = Array.from({ length: TOTAL_HOURS }).map((_, i) => HOUR_START + i);

  const weekLabel = useMemo(() => {
    if (view === "month") {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    if (view === "day") {
      return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    const s = weekDays[0];
    const e = weekDays[daysCount - 1];
    if (isSameMonth(s, e)) {
      return `${format(s, "d")}–${format(e, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
    return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
  }, [weekDays, view, currentDate]);

  const goToday = () => { setCurrentDate(new Date()); setMiniCalMonth(new Date()); };
  const goPrev = () => {
    const next = view === "day" ? addDays(currentDate, -1)
      : view === "month" ? subMonths(currentDate, 1)
      : subWeeks(currentDate, 1);
    setCurrentDate(next); setMiniCalMonth(next);
  };
  const goNext = () => {
    const next = view === "day" ? addDays(currentDate, 1)
      : view === "month" ? addMonths(currentDate, 1)
      : addWeeks(currentDate, 1);
    setCurrentDate(next); setMiniCalMonth(next);
  };

  const handleRefreshAll = () => {
    refetch();
    refetchBlocked();
    setSelectedAppointment(null);
  };

  const handleSlotClick = (date: Date, hour: number, half: 0 | 30 = 0) => {
    const clickedMin = hour * 60 + half;
    const dayAppts = getDayAppointments(date);
    const dayBlocked = getDayBlockedSlots(date);

    const isBlocked = dayBlocked.some((b) =>
      timeToMinutes(b.startTime) <= clickedMin && clickedMin < timeToMinutes(b.endTime)
    );
    if (isBlocked) return;

    const overlapping = dayAppts.filter((apt) => {
      if (["cancelado", "faltou"].includes(apt.status)) return false;
      return timeToMinutes(apt.startTime) <= clickedMin && clickedMin < timeToMinutes(apt.endTime);
    });

    if (overlapping.length > 0) {
      // Check if any overlapping procedure still has capacity (group sessions)
      const hasCapacity = overlapping.some((apt) => {
        const maxCap = apt.procedure?.maxCapacity ?? 1;
        if (maxCap <= 1) return false;
        const sameSession = dayAppts.filter(
          (a) =>
            !["cancelado", "faltou"].includes(a.status) &&
            a.procedureId === apt.procedureId &&
            a.startTime === apt.startTime
        ).length;
        return sameSession < maxCap;
      });
      if (!hasCapacity) return;
    }

    setSelectedSlot({
      date: format(date, "yyyy-MM-dd"),
      time: `${String(hour).padStart(2, "0")}:${half === 30 ? "30" : "00"}`,
    });
    setIsNewModalOpen(true);
  };

  const getDayAppointments = (day: Date) =>
    appointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));

  const getDayBlockedSlots = (day: Date) =>
    blockedSlots.filter((b) => b.date === format(day, "yyyy-MM-dd"));

  return (
    <AppLayout title="Agenda">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalIcon className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold font-display text-slate-800">Calendário</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Today */}
          <Button variant="outline" size="sm" className="rounded-lg h-9 px-3 text-sm" onClick={goToday}>
            Hoje
          </Button>

          {/* Week nav */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              className="p-2 hover:bg-slate-100 transition-colors"
              onClick={goPrev}
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              className="p-2 hover:bg-slate-100 transition-colors"
              onClick={goNext}
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Week/day label */}
          <span className={cn(
            "text-sm font-semibold text-slate-700",
            view === "day" ? "capitalize min-w-[260px]" : "min-w-[200px]"
          )}>
            {weekLabel}
          </span>

          {/* View toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs font-medium">
            <button
              className={cn("px-3 h-9 transition-colors", view === "day" ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-600")}
              onClick={() => setView("day")}
            >
              Dia
            </button>
            <button
              className={cn("px-3 h-9 transition-colors border-l border-slate-200", view === "fullweek" ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-600")}
              onClick={() => setView("fullweek")}
            >
              Semana
            </button>
            <button
              className={cn("px-3 h-9 transition-colors border-l border-slate-200", view === "month" ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-600")}
              onClick={() => setView("month")}
            >
              Mês
            </button>
          </div>

          {/* Block button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 rounded-lg border-slate-300 text-slate-600 hover:bg-slate-100"
            onClick={() => setIsBlockModalOpen(true)}
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Bloquear
          </Button>

          {/* New button */}
          <Button
            size="sm"
            className="h-9 px-4 rounded-lg shadow-md shadow-primary/20"
            onClick={() => { setSelectedSlot(null); setIsNewModalOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo
          </Button>
        </div>
      </div>

      {/* ── Main body ────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── LEFT: Mini calendar + legend ─────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0">
          <MiniCalendar
            value={currentDate}
            month={miniCalMonth}
            onMonthChange={setMiniCalMonth}
            onSelectDate={(d) => setCurrentDate(d)}
            weekDays={weekDays}
          />

          {/* Legend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Legenda</p>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-xs text-slate-600">{cfg.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-violet-500" />
              <span className="text-xs text-slate-600">Sessão em grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300" />
              <span className="text-xs text-slate-600">Bloqueado</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Calendar grid ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

          {/* ── MONTH VIEW ─────────────────────────────────────────────── */}
          {view === "month" && (
            <MonthGrid
              currentDate={currentDate}
              appointments={appointments}
              blockedSlots={blockedSlots}
              onDayClick={(day) => { setCurrentDate(day); setMiniCalMonth(day); setView("day"); }}
              onNewAppointment={(dateStr) => { setSelectedSlot({ date: dateStr, time: "" }); setIsNewModalOpen(true); }}
            />
          )}

          {/* Day headers + time grid — only for week/day view */}
          {view !== "month" && (
          <><div
            className="grid border-b border-slate-200 bg-slate-50/70"
            style={{ gridTemplateColumns: `56px repeat(${daysCount}, 1fr)` }}
          >
            <div className="border-r border-slate-200" />
            {weekDays.map((day, i) => {
              const dayAppts = getDayAppointments(day);
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={cn(
                    "py-3 px-2 text-center border-r border-slate-200 last:border-r-0",
                    today && "bg-primary/5"
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors",
                        today ? "bg-primary text-white" : "text-slate-800"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  {dayAppts.length > 0 && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {dayAppts.length} consulta{dayAppts.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
              <div
                className="grid relative"
                style={{ gridTemplateColumns: `56px repeat(${daysCount}, 1fr)` }}
              >
                {/* Hour labels column */}
                <div className="border-r border-slate-200">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="border-b border-slate-100 flex items-start justify-end pr-2 pt-1"
                      style={{ height: SLOT_HEIGHT }}
                    >
                      <span className="text-[10px] font-medium text-slate-400 leading-none">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, di) => {
                  const dayAppts = getDayAppointments(day);
                  const dayBlocked = getDayBlockedSlots(day);
                  const today = isToday(day);

                  const positioned = positionAppointments(dayAppts);

                  return (
                    <div
                      key={di}
                      className={cn(
                        "border-r border-slate-200 last:border-r-0 relative",
                        today && "bg-primary/[0.02]"
                      )}
                      style={{ height: TOTAL_HOURS * SLOT_HEIGHT }}
                    >
                      {/* Hour lines — split into two 30-min clickable halves */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-b border-slate-100"
                          style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        >
                          {/* Top half: :00 */}
                          <div
                            className="absolute left-0 right-0 cursor-pointer hover:bg-primary/5 transition-colors group/half"
                            style={{ top: 0, height: SLOT_HEIGHT / 2 }}
                            onClick={() => handleSlotClick(day, h, 0)}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/half:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-[9px] font-semibold text-primary/60 bg-primary/10 rounded px-1">
                                +{String(h).padStart(2, "0")}:00
                              </span>
                            </div>
                          </div>
                          {/* Half-hour divider */}
                          <div className="absolute left-0 right-0 border-b border-slate-100/80" style={{ top: SLOT_HEIGHT / 2 }} />
                          {/* Bottom half: :30 */}
                          <div
                            className="absolute left-0 right-0 cursor-pointer hover:bg-primary/5 transition-colors group/half"
                            style={{ top: SLOT_HEIGHT / 2, height: SLOT_HEIGHT / 2 }}
                            onClick={() => handleSlotClick(day, h, 30)}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/half:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-[9px] font-semibold text-primary/60 bg-primary/10 rounded px-1">
                                +{String(h).padStart(2, "0")}:30
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Current time line */}
                      {today && <CurrentTimeLine />}

                      {/* Blocked slots overlays */}
                      {dayBlocked.map((block) => {
                        const startMin = timeToMinutes(block.startTime);
                        const endMin = timeToMinutes(block.endTime);
                        const top = minutesToTop(startMin);
                        const height = Math.max(minutesToHeight(endMin - startMin), 20);
                        const short = height < 40;
                        return (
                          <div
                            key={block.id}
                            className="absolute left-0 right-0 z-[5] bg-slate-200/80 border border-slate-300 border-dashed rounded overflow-hidden pointer-events-none"
                            style={{ top: top + 1, height: height - 2 }}
                          >
                            <div className="flex items-center gap-1 px-1.5 py-0.5">
                              <Ban className="w-3 h-3 text-slate-500 shrink-0" />
                              {!short && (
                                <span className="text-[9px] font-semibold text-slate-500 truncate">
                                  {block.reason || "Bloqueado"} · {block.startTime}–{block.endTime}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Appointments */}
                      {positioned.map((item) => {
                        if (item.type === "group") {
                          const { appointments: grpApts, startTime, endTime, maxCapacity, col, totalCols } = item;
                          const startMin = timeToMinutes(startTime);
                          const endMin = timeToMinutes(endTime);
                          const top = minutesToTop(startMin);
                          const height = Math.max(minutesToHeight(endMin - startMin), 28);
                          const widthPct = 100 / totalCols;
                          const leftPct = col * widthPct;
                          const short = height < 48;
                          const occupancy = grpApts.length;
                          const spotsLeft = maxCapacity - occupancy;
                          const firstApt = grpApts[0];

                          return (
                            <div
                              key={`group-${item.procedureId}-${startTime}`}
                              className="absolute rounded-lg px-2 py-1 cursor-pointer overflow-hidden transition-all hover:brightness-95 hover:shadow-md z-10 border-l-2 bg-violet-500 text-white border-violet-600"
                              style={{
                                top: top + 2,
                                height: height - 4,
                                left: `${leftPct + 1}%`,
                                width: `${widthPct - 2}%`,
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointment(firstApt); }}
                            >
                              {short ? (
                                <div className="flex items-center gap-1">
                                  <Users className="w-2.5 h-2.5 shrink-0 opacity-80" />
                                  <p className="text-[10px] font-semibold truncate">
                                    {startTime} · {occupancy}/{maxCapacity}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="text-[11px] font-bold truncate leading-tight flex-1">
                                      {firstApt.procedure?.name}
                                    </p>
                                    <span className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-tight",
                                      spotsLeft > 0 ? "bg-white/25 text-white" : "bg-red-200 text-red-800"
                                    )}>
                                      {occupancy}/{maxCapacity}
                                    </span>
                                  </div>
                                  <p className="text-[9px] opacity-70 mt-0.5">{startTime} – {endTime}</p>
                                  <p className="text-[9px] opacity-90 truncate leading-tight mt-1">
                                    {grpApts.map((a) => a.patient?.name?.split(" ")[0]).join(" · ")}
                                  </p>
                                  {spotsLeft > 0 && height >= 80 && (
                                    <p className="text-[9px] opacity-60 flex items-center gap-0.5 mt-0.5">
                                      <Users className="w-2.5 h-2.5" /> {spotsLeft} vaga{spotsLeft !== 1 ? "s" : ""} livre{spotsLeft !== 1 ? "s" : ""}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        }

                        // Single appointment
                        const { appointment: apt, col, totalCols } = item;
                        const startMin = timeToMinutes(apt.startTime);
                        const endMin = timeToMinutes(apt.endTime);
                        const top = minutesToTop(startMin);
                        const height = Math.max(minutesToHeight(endMin - startMin), 28);
                        const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.agendado;
                        const widthPct = 100 / totalCols;
                        const leftPct = col * widthPct;
                        const short = height < 48;

                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              "absolute rounded-lg px-2 py-1 cursor-pointer overflow-hidden transition-all hover:brightness-95 hover:shadow-md z-10 border-l-2",
                              cfg.bg, cfg.text, cfg.border
                            )}
                            style={{
                              top: top + 2,
                              height: height - 4,
                              left: `${leftPct + 1}%`,
                              width: `${widthPct - 2}%`,
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                          >
                            {short ? (
                              <div className="flex items-center gap-1">
                                {(apt as any).source === "online" && <Globe className="w-2.5 h-2.5 shrink-0 opacity-90" />}
                                <p className="text-[10px] font-semibold truncate leading-tight">
                                  {apt.patient?.name?.split(" ")[0]} · {apt.startTime}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-[11px] font-bold truncate leading-tight flex-1">{apt.patient?.name}</p>
                                  {(apt as any).source === "online" && (
                                    <Globe className="w-3 h-3 shrink-0 opacity-80 mt-0.5" />
                                  )}
                                </div>
                                <p className="text-[10px] opacity-80 truncate leading-tight mt-0.5">{apt.procedure?.name}</p>
                                <p className="text-[9px] opacity-70 mt-0.5">{apt.startTime} – {apt.endTime}</p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Agendar Consulta</DialogTitle>
          </DialogHeader>
          <CreateAppointmentForm
            initialDate={selectedSlot?.date}
            initialTime={selectedSlot?.time}
            initialProcedureId={selectedSlot?.procedureId}
            onSuccess={() => { setIsNewModalOpen(false); refetch(); }}
          />
        </DialogContent>
      </Dialog>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          allAppointments={appointments}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={handleRefreshAll}
          onAddToSession={(date, time, procedureId) => {
            setSelectedAppointment(null);
            setSelectedSlot({ date, time, procedureId });
            setIsNewModalOpen(true);
          }}
        />
      )}

      <BlockedSlotModal
        open={isBlockModalOpen}
        onOpenChange={setIsBlockModalOpen}
        onSuccess={() => { setIsBlockModalOpen(false); refetchBlocked(); }}
      />
    </AppLayout>
  );
}

// ─── Current Time Line ────────────────────────────────────────────────────────

function CurrentTimeLine() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < HOUR_START * 60 || minutes > HOUR_END * 60) return null;
  const top = minutesToTop(minutes);
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <div className="flex-1 h-[1.5px] bg-red-400" />
      </div>
    </div>
  );
}

// ─── Position Appointments (handle overlaps + group sessions) ─────────────────

type PositionedItem =
  | { type: "single"; appointment: Appointment; col: number; totalCols: number }
  | {
      type: "group";
      appointments: Appointment[];
      procedureId: number;
      startTime: string;
      endTime: string;
      maxCapacity: number;
      col: number;
      totalCols: number;
    };

function positionAppointments(appointments: Appointment[]): PositionedItem[] {
  if (appointments.length === 0) return [];

  // Separate group-session appointments from singles.
  // Cancelled/missed appointments in a group are shown individually.
  const groupMap = new Map<string, Appointment[]>();
  const singles: Appointment[] = [];

  for (const apt of appointments) {
    const maxCap = apt.procedure?.maxCapacity ?? 1;
    if (maxCap > 1 && !["cancelado", "faltou"].includes(apt.status)) {
      const key = `${apt.procedureId}|${apt.startTime}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(apt);
    } else {
      singles.push(apt);
    }
  }

  // Build a unified slot list for layout calculation.
  type Slot =
    | { kind: "single"; apt: Appointment }
    | { kind: "group"; key: string; apts: Appointment[] };

  const slots: Slot[] = [
    ...[...groupMap.entries()].map(([key, apts]) => ({ kind: "group" as const, key, apts })),
    ...singles.map((apt) => ({ kind: "single" as const, apt })),
  ];

  const getStart = (s: Slot) =>
    timeToMinutes(s.kind === "single" ? s.apt.startTime : s.apts[0].startTime);
  const getEnd = (s: Slot) =>
    timeToMinutes(s.kind === "single" ? s.apt.endTime : s.apts[0].endTime);

  slots.sort((a, b) => getStart(a) - getStart(b));

  // Overlap grouping for column layout.
  const layoutGroups: Slot[][] = [];
  let current: Slot[] = [];
  let maxEnd = 0;

  for (const slot of slots) {
    const start = getStart(slot);
    const end = getEnd(slot);
    if (current.length === 0 || start < maxEnd) {
      current.push(slot);
      maxEnd = Math.max(maxEnd, end);
    } else {
      layoutGroups.push(current);
      current = [slot];
      maxEnd = end;
    }
  }
  if (current.length > 0) layoutGroups.push(current);

  const result: PositionedItem[] = [];
  for (const group of layoutGroups) {
    const totalCols = group.length;
    group.forEach((slot, col) => {
      if (slot.kind === "single") {
        result.push({ type: "single", appointment: slot.apt, col, totalCols });
      } else {
        const first = slot.apts[0];
        result.push({
          type: "group",
          appointments: slot.apts,
          procedureId: first.procedureId,
          startTime: first.startTime,
          endTime: first.endTime,
          maxCapacity: first.procedure?.maxCapacity ?? slot.apts.length,
          col,
          totalCols,
        });
      }
    });
  }
  return result;
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  value,
  month,
  onMonthChange,
  onSelectDate,
  weekDays,
}: {
  value: Date;
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelectDate: (d: Date) => void;
  weekDays: Date[];
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const dayHeaders = ["S", "T", "Q", "Q", "S", "S", "D"];

  const isInWeek = (day: Date) => weekDays.some((wd) => isSameDay(wd, day));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="p-1 rounded hover:bg-slate-100 transition-colors"
          onClick={() => onMonthChange(subMonths(month, 1))}
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
        </button>
        <span className="text-xs font-semibold text-slate-700 capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button
          className="p-1 rounded hover:bg-slate-100 transition-colors"
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((h, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-slate-400 py-0.5">
            {h}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const sameMonth = isSameMonth(day, month);
          const today = isToday(day);
          const selected = isSameDay(day, value);
          const inWeek = isInWeek(day);

          return (
            <button
              key={i}
              className={cn(
                "h-6 w-full rounded text-[10px] font-medium transition-colors",
                !sameMonth && "text-slate-300",
                sameMonth && !today && !selected && "text-slate-600 hover:bg-slate-100",
                today && !selected && "text-primary font-bold",
                selected && "bg-primary text-white",
                inWeek && !selected && sameMonth && "bg-primary/10 text-primary"
              )}
              onClick={() => onSelectDate(day)}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Appointment Detail Modal ─────────────────────────────────────────────────

function AppointmentDetailModal({
  appointment,
  allAppointments,
  onClose,
  onRefresh,
  onAddToSession,
}: {
  appointment: Appointment;
  allAppointments: Appointment[];
  onClose: () => void;
  onRefresh: () => void;
  onAddToSession: (date: string, time: string, procedureId: number) => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const maxCap = appointment.procedure?.maxCapacity ?? 1;
  const isGroupSession = maxCap > 1;

  // All members of the session regardless of status, sorted by id for stable order
  const sessionSiblings = isGroupSession
    ? allAppointments.filter(
        (a) =>
          a.id !== appointment.id &&
          a.date === appointment.date &&
          a.procedureId === appointment.procedureId &&
          a.startTime === appointment.startTime
      ).sort((a, b) => a.id - b.id)
    : [];

  const allSessionMembers: Appointment[] = isGroupSession
    ? [appointment, ...sessionSiblings].sort((a, b) => a.id - b.id)
    : [appointment];

  // Capacity: only count non-cancelled/faltou members
  const occupiedCount = allSessionMembers.filter(
    (a) => !["cancelado", "faltou"].includes(a.status)
  ).length;
  const spotsLeft = maxCap - occupiedCount;
  const [editForm, setEditForm] = useState({
    status: appointment.status,
    notes: appointment.notes || "",
    date: appointment.date,
    startTime: appointment.startTime,
  });

  const updateMutation = useUpdateAppointment();
  const deleteMutation = useDeleteAppointment();
  const completeMutation = useCompleteAppointment();

  const cfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.agendado;
  const isBusy = updateMutation.isPending || deleteMutation.isPending || completeMutation.isPending;

  const handleUpdate = () => {
    updateMutation.mutate(
      { id: appointment.id, data: editForm },
      {
        onSuccess: () => { toast({ title: "Consulta atualizada." }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao atualizar." }),
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id: appointment.id, data: { status: newStatus as UpdateAppointmentRequestStatus } },
      {
        onSuccess: () => { toast({ title: `Status: ${STATUS_CONFIG[newStatus]?.label}` }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao alterar status." }),
      }
    );
  };

  const handleComplete = () => {
    completeMutation.mutate(
      { id: appointment.id },
      {
        onSuccess: () => { toast({ title: "Consulta concluída!", description: "Lançamento financeiro gerado." }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao concluir." }),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Excluir esta consulta?")) return;
    deleteMutation.mutate(
      { id: appointment.id },
      {
        onSuccess: () => { toast({ title: "Consulta excluída." }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao excluir." }),
      }
    );
  };

  // Per-member status/complete handlers (used for both group and single)
  const handleMemberStatusChange = (aptId: number, newStatus: string) => {
    updateMutation.mutate(
      { id: aptId, data: { status: newStatus as UpdateAppointmentRequestStatus } },
      {
        onSuccess: () => { toast({ title: `Status: ${STATUS_CONFIG[newStatus]?.label}` }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao alterar status." }),
      }
    );
  };

  const handleMemberComplete = (aptId: number) => {
    completeMutation.mutate(
      { id: aptId },
      {
        onSuccess: () => { toast({ title: "Consulta concluída!", description: "Lançamento financeiro gerado." }); onRefresh(); },
        onError: () => toast({ variant: "destructive", title: "Erro ao concluir." }),
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={cn("border-none shadow-2xl rounded-3xl", isGroupSession ? "sm:max-w-[520px]" : "sm:max-w-[480px]")}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", isGroupSession ? "bg-violet-500" : cfg.bg)}>
              {isGroupSession
                ? <Users className="w-4 h-4 text-white" />
                : <CalIcon className="w-4 h-4 text-white" />
              }
            </div>
            <div>
              <DialogTitle className="font-display text-xl">
                {isGroupSession ? "Sessão em Grupo" : "Detalhes da Consulta"}
              </DialogTitle>
              {isGroupSession ? (
                <p className="text-sm text-slate-500 mt-0.5">
                  {appointment.procedure?.name} · {appointment.startTime} – {appointment.endTime}
                </p>
              ) : (
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.badge}`}>
                  {cfg.label}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Info card — for single appointments only */}
          {!isGroupSession && (
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Paciente</p>
                  <p className="font-semibold text-slate-800">{appointment.patient?.name}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Procedimento</p>
                  <p className="font-semibold text-slate-800">{appointment.procedure?.name}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Data e Horário</p>
                  <p className="font-semibold text-slate-800">
                    {appointment.date ? format(new Date(appointment.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    {" "}&middot;{" "}{appointment.startTime} – {appointment.endTime}
                  </p>
                </div>
              </div>
              {appointment.notes && (
                <>
                  <Separator />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Observações</p>
                  <p className="text-sm text-slate-700">{appointment.notes}</p>
                </>
              )}
              {(appointment as any).source === "online" && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-500 shrink-0" />
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      Agendado pelo portal online
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Info summary for group sessions */}
          {isGroupSession && (
            <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <CalIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{appointment.date ? format(new Date(appointment.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{appointment.startTime} – {appointment.endTime}</span>
              </div>
              <span className={cn(
                "ml-auto text-xs font-bold px-2.5 py-1 rounded-full shrink-0",
                spotsLeft > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {occupiedCount}/{maxCap} ativos
              </span>
            </div>
          )}

          {/* Group session — per-patient status management */}
          {isGroupSession && !isEditing && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pacientes da Sessão</p>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
                {allSessionMembers.map((member) => {
                  const mCfg = STATUS_CONFIG[member.status] || STATUS_CONFIG.agendado;
                  const isCurrent = member.id === appointment.id;
                  const isDone = member.status === "concluido";
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "rounded-2xl border p-3 space-y-2.5 transition-colors",
                        isCurrent ? "border-violet-200 bg-violet-50/60" : "border-slate-100 bg-white"
                      )}
                    >
                      {/* Patient row */}
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", mCfg.bg)}>
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{member.patient?.name}</p>
                          {member.notes && (
                            <p className="text-[10px] text-slate-400 truncate">{member.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", mCfg.badge)}>
                            {mCfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Per-patient actions */}
                      {!isDone && (
                        <div className="flex gap-1.5 flex-wrap">
                          {member.status !== "confirmado" && member.status !== "cancelado" && member.status !== "faltou" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "confirmado")}
                              disabled={isBusy}
                            >
                              <CheckCircle className="w-3 h-3 inline mr-0.5" /> Confirmar
                            </button>
                          )}
                          {member.status === "confirmado" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "agendado")}
                              disabled={isBusy}
                            >
                              <RefreshCw className="w-3 h-3 inline mr-0.5" /> Desfazer
                            </button>
                          )}
                          {member.status !== "faltou" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "faltou")}
                              disabled={isBusy}
                            >
                              <AlertCircle className="w-3 h-3 inline mr-0.5" /> Faltou
                            </button>
                          )}
                          {member.status !== "cancelado" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "cancelado")}
                              disabled={isBusy}
                            >
                              <XCircle className="w-3 h-3 inline mr-0.5" /> Cancelar
                            </button>
                          )}
                          {(member.status === "faltou" || member.status === "cancelado") && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "agendado")}
                              disabled={isBusy}
                            >
                              <RefreshCw className="w-3 h-3 inline mr-0.5" /> Reativar
                            </button>
                          )}
                          <button
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 ml-auto"
                            onClick={() => handleMemberComplete(member.id)}
                            disabled={isBusy || member.status === "cancelado" || member.status === "faltou"}
                          >
                            {completeMutation.isPending ? (
                              <Loader2 className="w-3 h-3 inline animate-spin mr-0.5" />
                            ) : (
                              <CheckCircle className="w-3 h-3 inline mr-0.5" />
                            )}
                            Concluir
                          </button>
                        </div>
                      )}
                      {isDone && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-slate-400" /> Sessão concluída
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add patient */}
              {spotsLeft > 0 && (
                <Button
                  size="sm"
                  className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => onAddToSession(appointment.date, appointment.startTime, appointment.procedureId)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar paciente ({spotsLeft} vaga{spotsLeft !== 1 ? "s" : ""} livre{spotsLeft !== 1 ? "s" : ""})
                </Button>
              )}
            </div>
          )}

          {/* Status actions — ONLY for single (non-group) appointments */}
          {!isGroupSession && !isEditing && appointment.status !== "concluido" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {appointment.status !== "confirmado" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleStatusChange("confirmado")} disabled={isBusy}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirmar
                  </Button>
                )}
                {appointment.status !== "faltou" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => handleStatusChange("faltou")} disabled={isBusy}>
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> Faltou
                  </Button>
                )}
                {appointment.status !== "cancelado" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleStatusChange("cancelado")} disabled={isBusy}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                )}
                <Button size="sm" className="rounded-xl"
                  onClick={handleComplete} disabled={isBusy}>
                  {completeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                  Concluir
                </Button>
              </div>
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Editar Consulta</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <DatePickerPTBR value={editForm.date} onChange={(v) => setEditForm({ ...editForm, date: v })} className="rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário</Label>
                  <TimeInputPTBR value={editForm.startTime} onChange={(v) => setEditForm({ ...editForm, startTime: v })} className="rounded-xl h-10" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as AppointmentStatus })}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="rounded-xl resize-none" rows={2} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="rounded-xl flex-1" onClick={handleUpdate} disabled={isBusy}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setIsEditing(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" className="rounded-xl text-red-500 hover:bg-red-50"
              onClick={handleDelete} disabled={isBusy}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
            {!isEditing && (
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Appointment Form ──────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

interface TreatmentPlan {
  id: number;
  patientId: number;
  objectives: string | null;
  techniques: string | null;
  frequency: string | null;
  estimatedSessions: number | null;
  status: string;
}

function CreateAppointmentForm({
  initialDate,
  initialTime,
  initialProcedureId,
  onSuccess,
}: {
  initialDate?: string;
  initialTime?: string;
  initialProcedureId?: number;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [patientSearch, setPatientSearch] = useState("");

  const [formData, setFormData] = useState({
    patientId: "",
    procedureId: initialProcedureId ? String(initialProcedureId) : "",
    date: initialDate || format(new Date(), "yyyy-MM-dd"),
    startTime: initialTime || "",
    notes: "",
  });

  // Recurring
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurDays, setRecurDays] = useState<number[]>(() => {
    if (initialDate) {
      const dow = new Date(initialDate + "T12:00:00").getDay();
      return [dow];
    }
    return [];
  });
  const [recurSessions, setRecurSessions] = useState(8);
  const [recurPending, setRecurPending] = useState(false);

  const { data: patients } = useListPatients({ limit: 1000 });
  const { data: procedures } = useListProcedures();
  const mutation = useCreateAppointment();
  const { toast } = useToast();

  const selectedPatient = useMemo(
    () => patients?.data?.find((p) => p.id === Number(formData.patientId)),
    [patients, formData.patientId]
  );

  const filteredPatients = useMemo(() => {
    if (!patients?.data) return [];
    if (!patientSearch.trim()) return patients.data;
    const q = patientSearch.toLowerCase();
    return patients.data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.cpf && p.cpf.includes(q))
    );
  }, [patients, patientSearch]);

  const { data: treatmentPlan } = useQuery<TreatmentPlan | null>({
    queryKey: ["treatment-plan", formData.patientId],
    queryFn: async () => {
      const res = await fetch(`/api/medical-records/${formData.patientId}/treatment-plan`, { credentials: "include" });
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!formData.patientId,
    staleTime: 60_000,
  });

  const { data: lastAppointments } = useQuery<{ appointment: { procedureId: number | null } }[]>({
    queryKey: ["last-appointments", formData.patientId],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments?patientId=${formData.patientId}&limit=5`,
        { credentials: "include" }
      );
      return res.json();
    },
    enabled: !!formData.patientId,
    staleTime: 60_000,
  });

  const lastProcedureId = useMemo(() => {
    if (!lastAppointments || !Array.isArray(lastAppointments)) return null;
    const first = lastAppointments[0];
    return first?.appointment?.procedureId ?? null;
  }, [lastAppointments]);

  const selectedProcedure = useMemo(
    () => procedures?.find((p) => p.id === Number(formData.procedureId)),
    [procedures, formData.procedureId]
  );

  const canFetchSlots = !!(formData.date && formData.procedureId);
  const { data: slotsData, isFetching: slotsFetching } = useQuery({
    queryKey: ["available-slots", formData.date, formData.procedureId],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments/available-slots?date=${formData.date}&procedureId=${formData.procedureId}&clinicStart=07:00&clinicEnd=19:00`
      );
      return res.json();
    },
    enabled: canFetchSlots,
    staleTime: 30_000,
  });

  const availableSlots = (slotsData?.slots ?? []) as { time: string; available: boolean; spotsLeft: number }[];

  const computedEndTime = useMemo(() => {
    if (!formData.startTime || !selectedProcedure) return null;
    const [h, m] = formData.startTime.split(":").map(Number);
    const total = h * 60 + m + selectedProcedure.durationMinutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }, [formData.startTime, selectedProcedure]);

  const toggleRecurDay = (dow: number) => {
    setRecurDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startTime) {
      toast({ variant: "destructive", title: "Selecione um horário." });
      return;
    }

    if (isRecurring) {
      if (recurDays.length === 0) {
        toast({ variant: "destructive", title: "Selecione ao menos um dia da semana." });
        return;
      }
      if (recurSessions < 1 || recurSessions > 100) {
        toast({ variant: "destructive", title: "Número de sessões deve ser entre 1 e 100." });
        return;
      }
      setRecurPending(true);
      try {
        const res = await fetch("/api/appointments/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            patientId: Number(formData.patientId),
            procedureId: Number(formData.procedureId),
            date: formData.date,
            startTime: formData.startTime,
            notes: formData.notes || undefined,
            recurrence: { daysOfWeek: recurDays, totalSessions: recurSessions },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ variant: "destructive", title: "Erro ao criar recorrência", description: data.message || "Erro desconhecido." });
        } else {
          const skippedMsg = data.skipped > 0 ? ` (${data.skipped} horário(s) com conflito foram pulados)` : "";
          toast({
            title: `${data.created} sessão(ões) agendada(s)!`,
            description: `Recorrência criada com sucesso.${skippedMsg}`,
          });
          onSuccess();
        }
      } catch {
        toast({ variant: "destructive", title: "Erro ao criar recorrência." });
      } finally {
        setRecurPending(false);
      }
      return;
    }

    mutation.mutate(
      {
        data: {
          patientId: Number(formData.patientId),
          procedureId: Number(formData.procedureId),
          date: formData.date,
          startTime: formData.startTime,
          notes: formData.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Agendado!", description: "Consulta marcada com sucesso." });
          onSuccess();
        },
        onError: (err: any) => {
          const msg = err?.data?.message || err?.message || "Conflito de horário.";
          toast({ variant: "destructive", title: "Erro ao agendar", description: msg });
        },
      }
    );
  };

  const isBusy = mutation.isPending || recurPending;
  const hasActivePlan = treatmentPlan && treatmentPlan.status === "ativo";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {/* ── Step indicators ── */}
      <div className="flex items-center gap-2 pb-1">
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
          step === 1 ? "bg-primary text-white" : "bg-emerald-100 text-emerald-700"
        )}>
          {step === 1 ? <User className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          Paciente
        </div>
        <div className="h-px flex-1 bg-slate-200" />
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
          step === 2 ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
        )}>
          <Stethoscope className="w-3 h-3" />
          Consulta
        </div>
      </div>

      {/* ══════════════════════════════════════ STEP 1: PACIENTE ══ */}
      {step === 1 && (
        <div className="space-y-3">
          {/* Search */}
          <div className="space-y-1.5">
            <Label>Buscar paciente *</Label>
            <Input
              placeholder="Nome, telefone ou CPF..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>

          {/* Patient list */}
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
            {filteredPatients.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum paciente encontrado.</p>
            )}
            {filteredPatients.map((p) => {
              const isSelected = formData.patientId === p.id.toString();
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, patientId: p.id.toString(), procedureId: "" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                    isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    {p.phone && <p className="text-xs text-slate-400 truncate">{p.phone}</p>}
                  </div>
                  {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Selected patient summary + plan info */}
          {selectedPatient && (
            <div className="space-y-2">
              {hasActivePlan && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-xs font-bold text-teal-700">Plano de Tratamento Ativo</span>
                  </div>
                  {treatmentPlan?.frequency && (
                    <p className="text-xs text-teal-600">
                      <span className="font-semibold">Frequência:</span> {treatmentPlan.frequency}
                    </p>
                  )}
                  {treatmentPlan?.objectives && (
                    <p className="text-xs text-teal-600 line-clamp-2">
                      <span className="font-semibold">Objetivos:</span> {treatmentPlan.objectives}
                    </p>
                  )}
                  {treatmentPlan?.techniques && (
                    <p className="text-xs text-teal-600 line-clamp-2">
                      <span className="font-semibold">Técnicas:</span> {treatmentPlan.techniques}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            className="w-full h-11 rounded-xl shadow-md shadow-primary/20"
            disabled={!formData.patientId}
            onClick={() => setStep(2)}
          >
            Continuar <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════ STEP 2: CONSULTA ══ */}
      {step === 2 && (
        <>
          {/* Patient summary bar */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{selectedPatient?.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{selectedPatient?.name}</p>
              {hasActivePlan && (
                <p className="text-[10px] text-teal-600 font-semibold flex items-center gap-1">
                  <ClipboardList className="w-3 h-3" /> Plano ativo
                </p>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-primary underline underline-offset-2 shrink-0"
              onClick={() => setStep(1)}
            >
              Trocar
            </button>
          </div>

          {/* Procedimento */}
          <div className="space-y-1.5">
            <Label>Procedimento *</Label>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
              {procedures?.map((p) => {
                const isSelected = formData.procedureId === p.id.toString();
                const isLast = lastProcedureId === p.id;
                const isGroup = (p as any).maxCapacity > 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, procedureId: p.id.toString() })}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary text-white" : isGroup ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {isGroup ? <Users className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                        {isLast && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <History className="w-2.5 h-2.5" /> Última sessão
                          </span>
                        )}
                        {hasActivePlan && isLast && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                            <Sparkles className="w-2.5 h-2.5" /> Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {p.durationMinutes} min
                        {isGroup ? ` · até ${(p as any).maxCapacity} simultâneos` : ""}
                      </p>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            {selectedProcedure && (
              <p className="text-xs text-slate-500 flex items-center gap-1 pl-1">
                <Clock className="w-3 h-3" />
                {selectedProcedure.durationMinutes} min
                {(selectedProcedure as any).maxCapacity > 1 && ` · até ${(selectedProcedure as any).maxCapacity} simultâneos`}
              </p>
            )}
          </div>

          {/* Data + Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <DatePickerPTBR
                value={formData.date}
                onChange={(v) => {
                  const dow = new Date(v + "T12:00:00").getDay();
                  setFormData({ ...formData, date: v, startTime: "" });
                  if (isRecurring && recurDays.length === 0) setRecurDays([dow]);
                }}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Horário *</Label>
              {canFetchSlots ? (
                <div>
                  {slotsFetching ? (
                    <div className="h-11 rounded-xl border border-slate-200 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <Select value={formData.startTime} onValueChange={(v) => setFormData({ ...formData, startTime: v })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                    {availableSlots.filter(s => s.available).map((s) => (
                      <SelectItem key={s.time} value={s.time}>
                        {s.time}{s.spotsLeft < 99 ? ` · ${s.spotsLeft} vaga(s)` : ""}
                      </SelectItem>
                    ))}
                    {availableSlots.filter(s => !s.available).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider border-t border-slate-100 mt-1">Indisponíveis</div>
                        {availableSlots.filter(s => !s.available).map((s) => (
                          <SelectItem key={s.time} value={s.time} disabled>
                            {s.time} · Lotado
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
              {formData.startTime && computedEndTime && (
                <p className="text-xs text-slate-500 mt-1 pl-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Término: {computedEndTime}
                </p>
              )}
            </div>
          ) : (
            <TimeInputPTBR
              value={formData.startTime}
              onChange={(v) => setFormData({ ...formData, startTime: v })}
              className="h-11 rounded-xl"
            />
          )}
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea
          placeholder="Queixas, observações clínicas..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>

      {/* Recorrência toggle */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer select-none"
          onClick={() => setIsRecurring((v) => !v)}
          onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setIsRecurring((v) => !v) : undefined}
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-slate-700">Agendamento recorrente</span>
          </div>
          {/* Pure CSS toggle — no Radix inside Dialog */}
          <div className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors pointer-events-none",
            isRecurring ? "bg-primary" : "bg-input"
          )}>
            <span className={cn(
              "block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
              isRecurring ? "translate-x-4" : "translate-x-0"
            )} />
          </div>
        </div>

        {isRecurring && (
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 bg-slate-50/60">
            <p className="text-xs text-slate-500">
              Cria automaticamente todas as sessões com o mesmo horário nos dias selecionados, a partir da data escolhida.
            </p>

            {/* Days of week */}
            <div className="space-y-1.5">
              <Label className="text-xs">Dias da semana *</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleRecurDay(d.value)}
                    className={cn(
                      "w-10 h-9 rounded-lg text-xs font-semibold transition-all border",
                      recurDays.includes(d.value)
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total sessions */}
            <div className="space-y-1.5">
              <Label className="text-xs">Total de sessões *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={recurSessions}
                  onChange={(e) => setRecurSessions(Number(e.target.value))}
                  className="h-9 w-24 rounded-xl text-sm"
                />
                <span className="text-xs text-slate-500">sessões · a partir de {formData.date ? format(new Date(formData.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
              </div>
            </div>

            {recurDays.length > 0 && recurSessions > 0 && (
              <div className="flex items-center gap-1.5 bg-primary/5 rounded-xl px-3 py-2">
                <RefreshCw className="w-3 h-3 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  {recurSessions} sessão(ões) toda(s){" "}
                  {recurDays.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(", ")}{" "}
                  às {formData.startTime || "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
            disabled={!formData.patientId || !formData.procedureId || !formData.startTime || isBusy}
          >
            {isBusy ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {isRecurring ? "Criando recorrência..." : "Agendando..."}</>
            ) : isRecurring ? (
              <><Repeat className="w-4 h-4 mr-2" /> Criar {recurSessions} sessão(ões) recorrente(s)</>
            ) : (
              <><CalIcon className="w-4 h-4 mr-2" /> Confirmar Agendamento</>
            )}
          </Button>
        </>
      )}
    </form>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  currentDate,
  appointments,
  blockedSlots,
  onDayClick,
  onNewAppointment,
}: {
  currentDate: Date;
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
  onDayClick: (day: Date) => void;
  onNewAppointment: (dateStr: string) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekHeaders = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const getDayAppts = (day: Date) =>
    appointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));

  const getDayBlocked = (day: Date) =>
    blockedSlots.filter((b) => b.date === format(day, "yyyy-MM-dd"));

  const STATUS_COLORS: Record<string, string> = {
    agendado: "bg-blue-400",
    confirmado: "bg-emerald-400",
    concluido: "bg-slate-400",
    cancelado: "bg-red-400",
    faltou: "bg-orange-400",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
        {weekHeaders.map((h) => (
          <div key={h} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const dayAppts = getDayAppts(day);
          const dayBlocked = getDayBlocked(day);
          const hasBlock = dayBlocked.length > 0;
          const visibleAppts = dayAppts.slice(0, 3);
          const overflow = dayAppts.length - 3;

          return (
            <div
              key={i}
              className={cn(
                "border-r border-b border-slate-100 p-1.5 cursor-pointer group transition-colors",
                !inMonth && "bg-slate-50/60",
                today && "bg-primary/[0.03]",
                hasBlock && inMonth && "bg-slate-100/80",
                "hover:bg-slate-50"
              )}
              onClick={() => inMonth && onDayClick(day)}
            >
              {/* Day number row */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                    !inMonth && "text-slate-300",
                    inMonth && !today && "text-slate-700",
                    today && "bg-primary text-white"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex items-center gap-1">
                  {hasBlock && <Lock className="w-3 h-3 text-slate-400" />}
                  {inMonth && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-primary/10 text-primary"
                      onClick={(e) => { e.stopPropagation(); onNewAppointment(dateStr); }}
                      title="Novo agendamento"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Appointment pills */}
              <div className="space-y-0.5">
                {visibleAppts.map((apt) => {
                  const color = STATUS_COLORS[apt.status] || "bg-blue-400";
                  const isOnline = (apt as any).source === "online";
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold text-white truncate leading-tight flex items-center gap-0.5",
                        color
                      )}
                      title={`${apt.startTime} · ${apt.patient?.name}${isOnline ? " · Online" : ""}`}
                    >
                      {isOnline && <Globe className="w-2 h-2 shrink-0 opacity-90" />}
                      {apt.startTime} {apt.patient?.name?.split(" ")[0]}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="text-[9px] text-slate-500 font-medium px-1">
                    +{overflow} mais
                  </div>
                )}
                {hasBlock && dayAppts.length === 0 && (
                  <div className="text-[9px] text-slate-400 font-medium px-1 flex items-center gap-0.5">
                    <Ban className="w-2.5 h-2.5" />
                    {dayBlocked[0].reason || "Bloqueado"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Blocked Slot Modal ───────────────────────────────────────────────────────

function BlockedSlotModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "08:00",
    endTime: "09:00",
    reason: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data: existingBlocks = [], refetch: refetchList } = useQuery<BlockedSlot[]>({
    queryKey: ["blocked-slots-modal", form.date],
    queryFn: async () => {
      const res = await fetch(`/api/blocked-slots?date=${form.date}`, { credentials: "include" });
      return res.json();
    },
    enabled: open,
    staleTime: 5_000,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.startTime >= form.endTime) {
      toast({ variant: "destructive", title: "Horário inválido", description: "O horário de início deve ser antes do término." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          reason: form.reason || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ variant: "destructive", title: "Erro ao bloquear", description: data.message || "Erro desconhecido." });
      } else {
        toast({ title: "Horário bloqueado!", description: `${form.date} · ${form.startTime}–${form.endTime}` });
        refetchList();
        onSuccess();
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao bloquear horário." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/blocked-slots/${id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Bloqueio removido." });
      refetchList();
      onSuccess();
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover bloqueio." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100">
              <Lock className="w-4 h-4 text-slate-600" />
            </div>
            <DialogTitle className="font-display text-xl">Bloquear Horário</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <DatePickerPTBR
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início *</Label>
              <TimeInputPTBR
                value={form.startTime}
                onChange={(v) => setForm({ ...form, startTime: v })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Término *</Label>
              <TimeInputPTBR
                value={form.endTime}
                onChange={(v) => setForm({ ...form, endTime: v })}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input
              placeholder="Ex: Almoço, Reunião, Feriado..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>

          <Button type="submit" className="w-full h-11 rounded-xl" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            Bloquear horário
          </Button>
        </form>

        {/* Existing blocks for the selected date */}
        {existingBlocks.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Bloqueios neste dia
            </p>
            <div className="space-y-1.5">
              {existingBlocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Ban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700">{b.startTime}–{b.endTime}</span>
                    {b.reason && (
                      <span className="text-xs text-slate-500 truncate">{b.reason}</span>
                    )}
                  </div>
                  <button
                    className="ml-2 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    onClick={() => handleDelete(b.id)}
                    title="Remover bloqueio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
