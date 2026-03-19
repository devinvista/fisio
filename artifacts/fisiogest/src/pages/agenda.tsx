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
} from "lucide-react";
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

type Appointment = NonNullable<ReturnType<typeof useListAppointments>["data"]>[number];
type ViewMode = "workweek" | "fullweek";

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
  const [view, setView] = useState<ViewMode>("workweek");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const daysCount = view === "workweek" ? 5 : 6;
  const weekDays = Array.from({ length: daysCount }).map((_, i) => addDays(weekStart, i));

  const startDateStr = format(weekDays[0], "yyyy-MM-dd");
  const endDateStr = format(weekDays[daysCount - 1], "yyyy-MM-dd");

  const { data: appointments = [], isLoading, refetch } = useListAppointments({ startDate: startDateStr, endDate: endDateStr });

  const hours = Array.from({ length: TOTAL_HOURS }).map((_, i) => HOUR_START + i);

  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[daysCount - 1];
    if (isSameMonth(s, e)) {
      return `${format(s, "d")}–${format(e, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
    return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
  }, [weekDays]);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => { setCurrentDate(subWeeks(currentDate, 1)); setMiniCalMonth(subWeeks(currentDate, 1)); };
  const goNext = () => { setCurrentDate(addWeeks(currentDate, 1)); setMiniCalMonth(addWeeks(currentDate, 1)); };

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date: format(date, "yyyy-MM-dd"), time: `${String(hour).padStart(2, "0")}:00` });
    setIsNewModalOpen(true);
  };

  const handleRefresh = () => {
    refetch();
    setSelectedAppointment(null);
  };

  const getDayAppointments = (day: Date) =>
    appointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));

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

          {/* Week label */}
          <span className="text-sm font-semibold text-slate-700 min-w-[200px]">
            {weekLabel}
          </span>

          {/* View toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs font-medium">
            <button
              className={cn("px-3 h-9 transition-colors", view === "workweek" ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-600")}
              onClick={() => setView("workweek")}
            >
              Semana de trabalho
            </button>
            <button
              className={cn("px-3 h-9 transition-colors border-l border-slate-200", view === "fullweek" ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-600")}
              onClick={() => setView("fullweek")}
            >
              Semana completa
            </button>
          </div>

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
          </div>
        </div>

        {/* ── RIGHT: Calendar grid ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

          {/* Day headers */}
          <div
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

          {/* Time grid */}
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
                  const today = isToday(day);

                  // Simple column layout — place appointments without overlap detection
                  // Group overlapping appointments into columns
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
                      {/* Hour lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-b border-slate-100 cursor-pointer hover:bg-slate-50/80 transition-colors group"
                          style={{ top: (h - HOUR_START) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                          onClick={() => handleSlotClick(day, h)}
                        >
                          {/* Half-hour line */}
                          <div className="absolute left-0 right-0 border-b border-slate-50" style={{ top: SLOT_HEIGHT / 2 }} />
                          {/* Plus hint */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Plus className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      ))}

                      {/* Current time line */}
                      {today && <CurrentTimeLine />}

                      {/* Appointments */}
                      {positioned.map(({ appointment: apt, col, totalCols }) => {
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
                              <p className="text-[10px] font-semibold truncate leading-tight">
                                {apt.patient?.name?.split(" ")[0]} · {apt.startTime}
                              </p>
                            ) : (
                              <>
                                <p className="text-[11px] font-bold truncate leading-tight">{apt.patient?.name}</p>
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
            onSuccess={() => { setIsNewModalOpen(false); refetch(); }}
          />
        </DialogContent>
      </Dialog>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={handleRefresh}
        />
      )}
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

// ─── Position Appointments (handle overlaps) ──────────────────────────────────

function positionAppointments(appointments: Appointment[]): {
  appointment: Appointment;
  col: number;
  totalCols: number;
}[] {
  if (appointments.length === 0) return [];

  // Sort by start time
  const sorted = [...appointments].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  // Simple overlap grouping
  const groups: Appointment[][] = [];
  let currentGroup: Appointment[] = [];
  let groupEnd = 0;

  for (const apt of sorted) {
    const start = timeToMinutes(apt.startTime);
    const end = timeToMinutes(apt.endTime);
    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(apt);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push(currentGroup);
      currentGroup = [apt];
      groupEnd = end;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result: { appointment: Appointment; col: number; totalCols: number }[] = [];
  for (const group of groups) {
    const cols = group.length;
    group.forEach((apt, idx) => {
      result.push({ appointment: apt, col: idx, totalCols: cols });
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
  onClose,
  onRefresh,
}: {
  appointment: Appointment;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
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
      { id: appointment.id, data: { status: newStatus } },
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", cfg.bg)}>
              <CalIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">Detalhes da Consulta</DialogTitle>
              <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Info card */}
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
          </div>

          {/* Status actions */}
          {!isEditing && appointment.status !== "concluido" && (
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
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
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
  const [formData, setFormData] = useState({
    patientId: "",
    procedureId: initialProcedureId ? String(initialProcedureId) : "",
    date: initialDate || format(new Date(), "yyyy-MM-dd"),
    startTime: initialTime || "",
    notes: "",
  });

  const { data: patients } = useListPatients({ limit: 1000 });
  const { data: procedures } = useListProcedures();
  const mutation = useCreateAppointment();
  const { toast } = useToast();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startTime) {
      toast({ variant: "destructive", title: "Selecione um horário." });
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
          const msg = err?.response?.data?.message || err?.message || "Conflito de horário.";
          toast({ variant: "destructive", title: "Erro ao agendar", description: msg });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Paciente *</Label>
        <Select value={formData.patientId} onValueChange={(v) => setFormData({ ...formData, patientId: v })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o paciente..." /></SelectTrigger>
          <SelectContent>
            {patients?.data?.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Procedimento *</Label>
        <Select value={formData.procedureId} onValueChange={(v) => setFormData({ ...formData, procedureId: v, startTime: "" })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o procedimento..." /></SelectTrigger>
          <SelectContent>
            {procedures?.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name} · {p.durationMinutes} min
                {(p as any).maxCapacity > 1 ? ` · ${(p as any).maxCapacity} vagas` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProcedure && (
          <p className="text-xs text-slate-500 flex items-center gap-1 pl-1">
            <Clock className="w-3 h-3" />
            {selectedProcedure.durationMinutes} min
            {(selectedProcedure as any).maxCapacity > 1 && ` · até ${(selectedProcedure as any).maxCapacity} simultâneos`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data *</Label>
          <DatePickerPTBR
            value={formData.date}
            onChange={(v) => setFormData({ ...formData, date: v, startTime: "" })}
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

      <Button
        type="submit"
        className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
        disabled={!formData.patientId || !formData.procedureId || !formData.startTime || mutation.isPending}
      >
        {mutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Agendando...</>
        ) : (
          <><CalIcon className="w-4 h-4 mr-2" /> Confirmar Agendamento</>
        )}
      </Button>
    </form>
  );
}
