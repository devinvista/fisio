import { useState, useMemo, useEffect, useLayoutEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
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
  getDay,
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
  CalendarDays,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { DatePickerPTBR, TimeInputPTBR } from "@/components/ui/date-picker-ptbr";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 19;
const SLOT_HEIGHT = 64; // px per hour
const TOTAL_HOURS = HOUR_END - HOUR_START;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string; badge: string; cardBg: string; cardSub: string }> = {
  agendado:   { label: "Agendado",   bg: "bg-blue-500",    text: "text-white", dot: "bg-blue-500",    border: "border-blue-600",    badge: "bg-blue-100 text-blue-700",         cardBg: "bg-blue-500",    cardSub: "text-white/70" },
  confirmado: { label: "Confirmado", bg: "bg-emerald-500", text: "text-white", dot: "bg-emerald-500", border: "border-emerald-600", badge: "bg-emerald-100 text-emerald-700",   cardBg: "bg-emerald-500", cardSub: "text-white/70" },
  compareceu: { label: "Compareceu", bg: "bg-teal-500",    text: "text-white", dot: "bg-teal-500",    border: "border-teal-600",    badge: "bg-teal-100 text-teal-700",         cardBg: "bg-teal-500",    cardSub: "text-white/70" },
  concluido:  { label: "Concluído",  bg: "bg-slate-400",   text: "text-white", dot: "bg-slate-400",   border: "border-slate-500",   badge: "bg-slate-100 text-slate-600",       cardBg: "bg-slate-400",   cardSub: "text-white/70" },
  cancelado:  { label: "Cancelado",  bg: "bg-red-400",     text: "text-white", dot: "bg-red-400",     border: "border-red-500",     badge: "bg-red-100 text-red-700",           cardBg: "bg-red-400",     cardSub: "text-white/70" },
  faltou:     { label: "Faltou",     bg: "bg-orange-400",  text: "text-white", dot: "bg-orange-400",  border: "border-orange-500",  badge: "bg-orange-100 text-orange-700",     cardBg: "bg-orange-400",  cardSub: "text-white/70" },
  remarcado:  { label: "Remarcado",  bg: "bg-purple-400",  text: "text-white", dot: "bg-purple-400",  border: "border-purple-500",  badge: "bg-purple-100 text-purple-700",     cardBg: "bg-purple-400",  cardSub: "text-white/70" },
};

type Appointment = AppointmentWithDetails;
type ViewMode = "day" | "fullweek" | "month";

interface BlockedSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
  scheduleId?: number | null;
  recurrenceGroupId?: string | null;
}

interface ScheduleOption {
  id: number;
  clinicId: number;
  name: string;
  type: string;
  professionalId: number | null;
  workingDays: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  color: string;
  professional: { id: number; name: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTop(minutes: number, hourStart: number = HOUR_START): number {
  return ((minutes - hourStart * 60) / 60) * SLOT_HEIGHT;
}

function minutesToHeight(minutes: number): number {
  return (minutes / 60) * SLOT_HEIGHT;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Agenda() {
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>(() =>
    window.innerWidth < 768 ? "day" : "fullweek"
  );
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; procedureId?: number } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlockedSlot | null>(null);
  const [showRemarcado, setShowRemarcado] = useState(false);
  const [quickCheckInId, setQuickCheckInId] = useState<number | null>(null);
  const [batchCompleting, setBatchCompleting] = useState(false);
  const quickUpdateMutation = useUpdateAppointment();
  const quickCompleteMutation = useCompleteAppointment();

  const { toast } = useToast();
  const { hasPermission, hasRole } = useAuth();
  const canFilterByProfessional = hasPermission("users.manage") || hasRole("secretaria");

  const { data: schedules = [] } = useQuery<ScheduleOption[]>({
    queryKey: ["schedules"],
    queryFn: () => fetch("/api/schedules").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: calendarProfessionals = [] } = useQuery<{ id: number; name: string; roles: string[] }[]>({
    queryKey: ["professionals"],
    queryFn: () => fetch("/api/users/professionals", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: canFilterByProfessional,
    select: (data) => data.filter((u) => u.roles.includes("profissional")),
  });

  const activeSchedules = schedules.filter((s) => s.isActive);

  const selectedSchedule = selectedScheduleId
    ? schedules.find((s) => s.id === selectedScheduleId) ?? null
    : null;

  // Determine visible hour range based on schedule configuration:
  // - If a specific schedule is selected → use its hours
  // - If there's only 1 active schedule → use it automatically
  // - If multiple schedules with none selected → span min start to max end
  // - Fallback to hardcoded constants only when no schedules are configured
  const effectiveSchedules = selectedSchedule
    ? [selectedSchedule]
    : activeSchedules.length > 0
      ? activeSchedules
      : null;

  const activeHourStart = effectiveSchedules
    ? Math.min(...effectiveSchedules.map((s) => parseInt(s.startTime.split(":")[0])))
    : HOUR_START;

  const activeHourEnd = effectiveSchedules
    ? Math.max(...effectiveSchedules.map((s) => {
        const h = parseInt(s.endTime.split(":")[0]);
        const m = parseInt(s.endTime.split(":")[1]);
        return m > 0 ? h + 1 : h;
      }))
    : HOUR_END;

  // Use the smallest slot duration among active schedule(s) so the grid is
  // always granular enough for all visible schedules.
  const VALID_SLOT_DURATIONS = [15, 20, 30, 45, 60, 90];
  const activeSlotDuration = effectiveSchedules
    ? Math.min(...effectiveSchedules.map((s) => s.slotDurationMinutes))
    : 30;
  // Clamp to a valid duration that divides evenly into 60 min
  const slotDuration = VALID_SLOT_DURATIONS.includes(activeSlotDuration)
    ? activeSlotDuration
    : 30;
  const slotsPerHour = Math.round(60 / slotDuration);
  const slotPxHeight = SLOT_HEIGHT / slotsPerHour;

  const activeTotalHours = activeHourEnd - activeHourStart;
  const hours = Array.from({ length: activeTotalHours }).map((_, i) => activeHourStart + i);

  const toTop = (minutes: number) => minutesToTop(minutes, activeHourStart);

  const scheduleColorMap = useMemo(() => {
    const map = new Map<number, string>();
    schedules.forEach((s) => map.set(s.id, s.color));
    return map;
  }, [schedules]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const allWeekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  // Derive the set of working day numbers (0=Sun … 6=Sat) from the active schedule(s).
  // null means no schedule is configured → show all 7 days.
  const workingDayNumbers: Set<number> | null = (() => {
    if (!effectiveSchedules) return null;
    const set = new Set<number>();
    effectiveSchedules.forEach((s) => {
      s.workingDays
        .split(",")
        .map((d) => parseInt(d.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
        .forEach((d) => set.add(d));
    });
    return set.size > 0 ? set : null;
  })();

  const weekDays = view === "day"
    ? [currentDate]
    : workingDayNumbers
      ? allWeekDays.filter((day) => workingDayNumbers.has(getDay(day)))
      : allWeekDays;

  const daysCount = weekDays.length;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Always fetch the full Mon–Sun range so switching schedule filters
  // doesn't discard already-loaded appointment data.
  const startDateStr = view === "month"
    ? format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(allWeekDays[0], "yyyy-MM-dd");
  const endDateStr = view === "month"
    ? format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd")
    : view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(allWeekDays[6], "yyyy-MM-dd");

  const { data: appointments = [], isLoading, refetch } = useListAppointments({ startDate: startDateStr, endDate: endDateStr });

  const selectedAppointment = selectedAppointmentId != null
    ? (appointments.find((a) => a.id === selectedAppointmentId) ?? null)
    : null;

  const filteredAppointments = appointments
    .filter((a) => !selectedScheduleId || a.scheduleId === selectedScheduleId || a.scheduleId == null)
    .filter((a) => !selectedProfessionalId || a.professionalId === selectedProfessionalId)
    .filter((a) => showRemarcado || a.status !== "remarcado");

  // Today's appointments with "compareceu" status (for batch complete button)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayCompareceu = filteredAppointments.filter(
    (a) => a.date === todayStr && a.status === "compareceu"
  );

  const handleQuickCheckIn = (aptId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickCheckInId(aptId);
    quickUpdateMutation.mutate(
      { id: aptId, data: { status: "compareceu" } },
      {
        onSuccess: () => { setQuickCheckInId(null); refetch(); },
        onError: () => { setQuickCheckInId(null); toast({ variant: "destructive", title: "Erro ao registrar chegada." }); },
      }
    );
  };

  const handleBatchComplete = async () => {
    if (todayCompareceu.length === 0) return;
    setBatchCompleting(true);
    try {
      await Promise.all(
        todayCompareceu.map((a) =>
          new Promise<void>((resolve) => {
            quickCompleteMutation.mutate({ id: a.id }, { onSuccess: () => resolve(), onError: () => resolve() });
          })
        )
      );
      toast({ title: `${todayCompareceu.length} consulta${todayCompareceu.length !== 1 ? "s" : ""} concluída${todayCompareceu.length !== 1 ? "s" : ""}!` });
      refetch();
    } finally {
      setBatchCompleting(false);
    }
  };

  const { data: blockedSlots = [], refetch: refetchBlocked } = useQuery<BlockedSlot[]>({
    queryKey: ["blocked-slots", startDateStr, endDateStr, selectedScheduleId],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: startDateStr, endDate: endDateStr });
      if (selectedScheduleId) params.set("scheduleId", String(selectedScheduleId));
      const res = await fetch(`/api/blocked-slots?${params}`, { credentials: "include" });
      return res.json();
    },
    staleTime: 30_000,
  });

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
    setSelectedAppointmentId(null);
  };

  const handleSlotClick = (date: Date, hour: number, offsetMin: number = 0) => {
    const clickedMin = hour * 60 + offsetMin;
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
      time: `${String(hour).padStart(2, "0")}:${String(offsetMin).padStart(2, "0")}`,
    });
    setIsNewModalOpen(true);
  };

  const getDayAppointments = (day: Date) =>
    filteredAppointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));

  const getDayBlockedSlots = (day: Date) =>
    blockedSlots.filter((b) => b.date === format(day, "yyyy-MM-dd"));

  return (
    <AppLayout title="Agenda">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalIcon className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold font-display text-slate-800">Calendário</span>
          </div>
          {activeSchedules.length >= 2 && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedScheduleId ?? ""}
                onChange={(e) => setSelectedScheduleId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="">Todas as agendas</option>
                {activeSchedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.type === "professional" && s.professional ? ` — ${s.professional.name}` : ""}</option>
                ))}
              </select>
              {selectedSchedule && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedSchedule.color }}
                />
              )}
            </div>
          )}
          {canFilterByProfessional && calendarProfessionals.length >= 2 && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedProfessionalId ?? ""}
                onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="">Todos os profissionais</option>
                {calendarProfessionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
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

          {/* Batch complete: shown only when there are compareceu appointments today */}
          {todayCompareceu.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 rounded-lg border-teal-300 text-teal-700 hover:bg-teal-50 gap-1.5"
              onClick={handleBatchComplete}
              disabled={batchCompleting}
            >
              {batchCompleting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle className="w-3.5 h-3.5" />}
              Concluir todos ({todayCompareceu.length})
            </Button>
          )}

          {/* Toggle remarcados */}
          <button
            className={cn(
              "h-9 px-3 rounded-lg text-xs font-medium border transition-colors",
              showRemarcado
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-slate-200 text-slate-400 hover:bg-slate-50"
            )}
            onClick={() => setShowRemarcado((v) => !v)}
            title={showRemarcado ? "Ocultar remarcados" : "Mostrar remarcados"}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              Remarcados
            </span>
          </button>

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
                <span className="text-xs text-slate-600">
                  {cfg.label}
                  {key === "compareceu" && <span className="ml-1 text-[9px] text-teal-600 font-semibold">• gera cobrança</span>}
                  {key === "concluido" && <span className="ml-1 text-[9px] text-slate-400 font-semibold">• encerrado</span>}
                </span>
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
            {activeSchedules.length >= 2 && (
              <>
                <div className="border-t border-slate-100 mt-2 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Agendas</p>
                  {activeSchedules.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 mb-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-slate-600 truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Calendar grid ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

          {/* ── MONTH VIEW ─────────────────────────────────────────────── */}
          {view === "month" && (
            <MonthGrid
              currentDate={currentDate}
              appointments={filteredAppointments}
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
              const dayNum = getDay(day);
              const schedulesOnDay = (!selectedScheduleId && activeSchedules.length >= 2)
                ? activeSchedules.filter((s) =>
                    s.workingDays.split(",").map((d) => parseInt(d.trim(), 10)).includes(dayNum)
                  )
                : [];
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
                  {schedulesOnDay.length > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {schedulesOnDay.map((s) => (
                        <span
                          key={s.id}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                          title={s.name}
                        />
                      ))}
                    </div>
                  )}
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
                      style={{ height: activeTotalHours * SLOT_HEIGHT }}
                    >
                      {/* Hour rows — sub-slots match the schedule's slotDurationMinutes */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-b border-slate-100"
                          style={{ top: (h - activeHourStart) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        >
                          {Array.from({ length: slotsPerHour }).map((_, si) => {
                            const offsetMin = si * slotDuration;
                            const mm = String(offsetMin).padStart(2, "0");
                            return (
                              <div key={si}>
                                {si > 0 && (
                                  <div
                                    className="absolute left-0 right-0 border-b border-slate-100/60"
                                    style={{ top: si * slotPxHeight, height: 0 }}
                                  />
                                )}
                                <div
                                  className="absolute left-0 right-0 cursor-pointer hover:bg-primary/5 transition-colors group/slot"
                                  style={{ top: si * slotPxHeight, height: slotPxHeight }}
                                  onClick={() => handleSlotClick(day, h, offsetMin)}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[9px] font-semibold text-primary/60 bg-primary/10 rounded px-1">
                                      +{String(h).padStart(2, "0")}:{mm}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Current time line */}
                      {today && <CurrentTimeLine hourStart={activeHourStart} hourEnd={activeHourEnd} />}

                      {/* Blocked slots overlays */}
                      {dayBlocked.map((block) => {
                        const startMin = timeToMinutes(block.startTime);
                        const endMin = timeToMinutes(block.endTime);
                        const top = toTop(startMin);
                        const height = Math.max(minutesToHeight(endMin - startMin), 20);
                        const short = height < 40;
                        return (
                          <div
                            key={block.id}
                            className="absolute left-0 right-0 z-[5] bg-slate-200/80 border border-slate-300 border-dashed rounded overflow-hidden cursor-pointer hover:bg-slate-300/80 group transition-colors"
                            style={{ top: top + 1, height: height - 2 }}
                            onClick={(e) => { e.stopPropagation(); setEditingBlock(block); }}
                            title="Clique para editar o bloqueio"
                          >
                            <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 h-full">
                              <div className="flex items-center gap-1 min-w-0">
                                <Ban className="w-3 h-3 text-slate-500 shrink-0" />
                                {!short && (
                                  <span className="text-[9px] font-semibold text-slate-500 truncate">
                                    {block.reason || "Bloqueado"} · {block.startTime}–{block.endTime}
                                  </span>
                                )}
                              </div>
                              {!short && (
                                <Pencil className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
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
                          const top = toTop(startMin);
                          const height = Math.max(minutesToHeight(endMin - startMin), 28);
                          const widthPct = 100 / totalCols;
                          const leftPct = col * widthPct;
                          const short = height < 48;
                          const occupancy = grpApts.length;
                          const spotsLeft = maxCapacity - occupancy;
                          const firstApt = grpApts[0];

                          const tiny = height < 36;
                          const grpScheduleColor = (!selectedScheduleId && activeSchedules.length >= 2 && firstApt.scheduleId)
                            ? scheduleColorMap.get(firstApt.scheduleId)
                            : undefined;

                          const allCompareceuOrDone = grpApts.every((a) => ["compareceu", "concluido"].includes(a.status));
                          const allConfirmedOrHigher = grpApts.every((a) => ["confirmado", "compareceu", "concluido"].includes(a.status));
                          const grpBg = allCompareceuOrDone ? "bg-teal-500" : allConfirmedOrHigher ? "bg-emerald-500" : "bg-violet-500";

                          return (
                            <div
                              key={`group-${item.procedureId}-${startTime}`}
                              className={`absolute rounded-xl overflow-hidden cursor-pointer z-10 transition-all duration-150 hover:brightness-95 hover:shadow-xl hover:z-20 ${grpBg}`}
                              style={{
                                top: top + 2,
                                height: height - 4,
                                left: `${leftPct + 1}%`,
                                width: `${widthPct - 2}%`,
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointmentId(firstApt.id); }}
                            >
                              {grpScheduleColor && (
                                <div
                                  className="absolute top-0 right-0 bottom-0 w-1 rounded-r-xl"
                                  style={{ backgroundColor: grpScheduleColor }}
                                  title={schedules.find((s) => s.id === firstApt.scheduleId)?.name}
                                />
                              )}
                              <div className="px-2.5 py-2 h-full flex flex-col text-white gap-0.5">
                                {tiny ? (
                                  /* Tiny: just time + occupancy badge */
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-[9px] font-bold leading-none truncate">{startTime}</p>
                                    <span className="text-[8px] font-bold bg-white/20 rounded-full px-1.5 py-0.5 leading-none shrink-0">
                                      {occupancy}/{maxCapacity}
                                    </span>
                                  </div>
                                ) : short ? (
                                  /* Short: title + badge + time */
                                  <>
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="text-[10px] font-bold truncate leading-tight flex-1">
                                        {firstApt.procedure?.name}
                                      </p>
                                      <span className={cn(
                                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none",
                                        spotsLeft > 0 ? "bg-white/20 text-white" : "bg-red-200/80 text-red-900"
                                      )}>
                                        {occupancy}/{maxCapacity}
                                      </span>
                                    </div>
                                    <p className="text-[9px] opacity-70 leading-none">{startTime} – {endTime}</p>
                                  </>
                                ) : (
                                  /* Normal: title + badge + time + patient chips */
                                  <>
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="text-[11px] font-bold truncate leading-tight flex-1">
                                        {firstApt.procedure?.name}
                                      </p>
                                      <span className={cn(
                                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none",
                                        spotsLeft > 0 ? "bg-white/20 text-white" : "bg-red-200/80 text-red-900"
                                      )}>
                                        {occupancy}/{maxCapacity}
                                      </span>
                                    </div>
                                    <p className="text-[9px] opacity-70 leading-none">{startTime} – {endTime}</p>
                                    <div className="flex flex-wrap gap-1 mt-auto pt-1">
                                      {grpApts.slice(0, 3).map((a) => (
                                        <span
                                          key={a.id}
                                          className="text-[9px] font-semibold bg-white/20 rounded-full px-2 py-0.5 leading-none whitespace-nowrap"
                                        >
                                          {a.patient?.name?.split(" ")[0]}
                                        </span>
                                      ))}
                                      {spotsLeft > 0 && (
                                        <span className="text-[9px] font-semibold bg-white/10 rounded-full px-2 py-0.5 leading-none opacity-70 whitespace-nowrap">
                                          +{spotsLeft}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Single appointment
                        const { appointment: apt, col, totalCols } = item;
                        const startMin = timeToMinutes(apt.startTime);
                        const endMin = timeToMinutes(apt.endTime);
                        const top = toTop(startMin);
                        const height = Math.max(minutesToHeight(endMin - startMin), 28);
                        const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.agendado;
                        const widthPct = 100 / totalCols;
                        const leftPct = col * widthPct;
                        const short = height < 48;

                        const tiny = height < 36;

                        const canQuickCheckIn = (apt.status === "agendado" || apt.status === "confirmado");
                        const isCheckingIn = quickCheckInId === apt.id;
                        const showScheduleIndicator = !selectedScheduleId && activeSchedules.length >= 2;
                        const aptScheduleColor = apt.scheduleId ? scheduleColorMap.get(apt.scheduleId) : undefined;

                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              "absolute rounded-xl overflow-hidden cursor-pointer z-10 transition-all duration-150 hover:brightness-95 hover:shadow-xl hover:z-20 group/card",
                              cfg.cardBg
                            )}
                            style={{
                              top: top + 2,
                              height: height - 4,
                              left: `${leftPct + 1}%`,
                              width: `${widthPct - 2}%`,
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelectedAppointmentId(apt.id); }}
                          >
                            {showScheduleIndicator && aptScheduleColor && (
                              <div
                                className="absolute top-0 right-0 bottom-0 w-1 rounded-r-xl"
                                style={{ backgroundColor: aptScheduleColor }}
                                title={schedules.find((s) => s.id === apt.scheduleId)?.name}
                              />
                            )}
                            <div className="px-2.5 py-2 h-full flex flex-col text-white gap-0.5">
                              {tiny ? (
                                <p className="text-[9px] font-bold leading-none truncate">
                                  {apt.patient?.name?.split(" ")[0]}
                                </p>
                              ) : short ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    {apt.source === "online" && <Globe className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                                    <p className="text-[10px] font-bold truncate leading-tight flex-1">
                                      {apt.patient?.name?.split(" ")[0]}
                                    </p>
                                  </div>
                                  <p className={cn("text-[9px] truncate leading-none", cfg.cardSub)}>{apt.procedure?.name}</p>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="text-[11px] font-bold truncate leading-tight flex-1">{apt.patient?.name}</p>
                                    {apt.source === "online" && (
                                      <Globe className="w-3 h-3 shrink-0 mt-0.5 opacity-80" />
                                    )}
                                  </div>
                                  <p className={cn("text-[10px] truncate leading-tight", cfg.cardSub)}>{apt.procedure?.name}</p>
                                  <p className={cn("text-[9px] tabular-nums", cfg.cardSub)}>{apt.startTime} – {apt.endTime}</p>
                                </>
                              )}
                            </div>

                            {/* Quick check-in button — visible on hover for agendado/confirmado */}
                            {canQuickCheckIn && !tiny && (
                              <div
                                className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="flex items-center gap-1 bg-white/25 hover:bg-white/40 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm transition-colors"
                                  onClick={(e) => handleQuickCheckIn(apt.id, e)}
                                  disabled={isCheckingIn}
                                >
                                  {isCheckingIn
                                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    : <CheckCircle className="w-2.5 h-2.5" />}
                                  Chegou
                                </button>
                              </div>
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
        <DialogContent className="sm:max-w-[520px] border-none shadow-2xl rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedSlot?.procedureId ? "Adicionar Paciente à Sessão" : "Agendar Consulta"}
            </DialogTitle>
          </DialogHeader>
          <CreateAppointmentForm
            initialDate={selectedSlot?.date}
            initialTime={selectedSlot?.time}
            initialProcedureId={selectedSlot?.procedureId}
            lockProcedure={!!selectedSlot?.procedureId}
            scheduleId={selectedScheduleId ?? undefined}
            clinicStart={String(activeHourStart).padStart(2, "0") + ":00"}
            clinicEnd={String(activeHourEnd).padStart(2, "0") + ":00"}
            onSuccess={() => { setIsNewModalOpen(false); refetch(); }}
          />
        </DialogContent>
      </Dialog>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          allAppointments={appointments}
          onClose={() => setSelectedAppointmentId(null)}
          onRefresh={handleRefreshAll}
          onAddToSession={(date, time, procedureId) => {
            setSelectedAppointmentId(null);
            setSelectedSlot({ date, time, procedureId });
            setIsNewModalOpen(true);
          }}
        />
      )}

      <BlockedSlotModal
        open={isBlockModalOpen}
        onOpenChange={setIsBlockModalOpen}
        onSuccess={() => { setIsBlockModalOpen(false); refetchBlocked(); }}
        activeSchedules={activeSchedules}
        defaultScheduleId={selectedScheduleId ?? undefined}
      />

      {editingBlock && (
        <BlockEditDialog
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSuccess={() => { setEditingBlock(null); refetchBlocked(); }}
        />
      )}
    </AppLayout>
  );
}

// ─── Current Time Line ────────────────────────────────────────────────────────

function CurrentTimeLine({ hourStart = HOUR_START, hourEnd = HOUR_END }: { hourStart?: number; hourEnd?: number }) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < hourStart * 60 || minutes > hourEnd * 60) return null;
  const top = minutesToTop(minutes, hourStart);
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

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ date: appointment.date, startTime: appointment.startTime });
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

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

  const executeStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id: appointment.id, data: { status: newStatus as UpdateAppointmentRequestStatus } },
      {
        onSuccess: () => {
          toast({ title: `Status: ${STATUS_CONFIG[newStatus]?.label}` });
          onRefresh();
          if (newStatus === "faltou") {
            toast({
              title: "Paciente não compareceu",
              description: "Deseja remarcar para outro horário?",
              action: (
                <button
                  onClick={() => setIsRescheduling(true)}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none"
                >
                  Remarcar
                </button>
              ) as any,
            });
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err?.message || "Erro ao alterar status.";
          toast({ variant: "destructive", title: "Erro", description: msg });
        },
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "cancelado" || newStatus === "faltou") {
      setPendingStatus(newStatus);
      return;
    }
    executeStatusChange(newStatus);
  };

  const handleReschedule = async () => {
    setRescheduleBusy(true);
    try {
      const token = localStorage.getItem("fisiogest_token");
      const res = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(rescheduleForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro ao remarcar", description: err.message || "Verifique o horário e tente novamente." });
        return;
      }
      toast({ title: "Remarcado com sucesso!", description: `Nova consulta em ${rescheduleForm.date} às ${rescheduleForm.startTime}.` });
      setIsRescheduling(false);
      onRefresh();
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Erro ao remarcar." });
    } finally {
      setRescheduleBusy(false);
    }
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
    <>
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
              {appointment.source === "online" && (
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
                          {member.status !== "confirmado" && member.status !== "compareceu" && member.status !== "cancelado" && member.status !== "faltou" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "confirmado")}
                              disabled={isBusy}
                            >
                              <CheckCircle className="w-3 h-3 inline mr-0.5" /> Confirmar
                            </button>
                          )}
                          {member.status !== "compareceu" && member.status !== "cancelado" && member.status !== "faltou" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "compareceu")}
                              disabled={isBusy}
                            >
                              <Users className="w-3 h-3 inline mr-0.5" /> Compareceu
                            </button>
                          )}
                          {member.status !== "faltou" && member.status !== "cancelado" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
                              onClick={() => handleMemberStatusChange(member.id, "faltou")}
                              disabled={isBusy}
                            >
                              <AlertCircle className="w-3 h-3 inline mr-0.5" /> Faltou
                            </button>
                          )}
                          {member.status !== "cancelado" && member.status !== "faltou" && (
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
                          {member.status !== "cancelado" && member.status !== "faltou" && (
                            <button
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 ml-auto"
                              onClick={() => handleMemberComplete(member.id)}
                              disabled={isBusy}
                            >
                              {completeMutation.isPending ? (
                                <Loader2 className="w-3 h-3 inline animate-spin mr-0.5" />
                              ) : (
                                <CheckCircle className="w-3 h-3 inline mr-0.5" />
                              )}
                              Concluir
                            </button>
                          )}
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
                {appointment.status !== "confirmado" && appointment.status !== "compareceu" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleStatusChange("confirmado")} disabled={isBusy}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirmar
                  </Button>
                )}
                {appointment.status !== "compareceu" && appointment.status !== "cancelado" && appointment.status !== "faltou" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => handleStatusChange("compareceu")} disabled={isBusy}>
                    <Users className="w-3.5 h-3.5 mr-1" /> Compareceu
                  </Button>
                )}
                {appointment.status !== "faltou" && appointment.status !== "cancelado" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => handleStatusChange("faltou")} disabled={isBusy}>
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> Faltou
                  </Button>
                )}
                {appointment.status !== "cancelado" && appointment.status !== "faltou" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleStatusChange("cancelado")} disabled={isBusy}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                )}
                {(appointment.status === "cancelado" || appointment.status === "faltou") && (
                  <Button size="sm" variant="outline" className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                    onClick={() => handleStatusChange("agendado")} disabled={isBusy}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reativar
                  </Button>
                )}
                {(appointment.status === "cancelado" || appointment.status === "faltou") && (
                  <Button size="sm" variant="outline" className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={() => setIsRescheduling(true)} disabled={isBusy}>
                    <Repeat className="w-3.5 h-3.5 mr-1" /> Remarcar
                  </Button>
                )}
                {appointment.status !== "cancelado" && appointment.status !== "faltou" && (
                  <Button size="sm" className="rounded-xl"
                    onClick={handleComplete} disabled={isBusy}>
                    {completeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                    Concluir
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Reschedule form (inline — avoids nested Dialog focus-trap issues) */}
          {isRescheduling && (
            <div className="space-y-3 bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" /> Remarcar consulta
              </p>
              <p className="text-sm text-slate-500">Selecione a nova data e horário para <strong>{appointment.patient?.name}</strong>.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nova data</Label>
                  <DatePickerPTBR value={rescheduleForm.date} onChange={(v) => setRescheduleForm(f => ({ ...f, date: v }))} className="rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Novo horário</Label>
                  <TimeInputPTBR value={rescheduleForm.startTime} onChange={(v) => setRescheduleForm(f => ({ ...f, startTime: v }))} className="rounded-xl h-10" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="rounded-xl flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleReschedule} disabled={rescheduleBusy}>
                  {rescheduleBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Repeat className="w-4 h-4 mr-1" />}
                  Confirmar remarcação
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setIsRescheduling(false)}>Cancelar</Button>
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

    {/* Confirmation dialog for destructive status changes */}
    <AlertDialog open={!!pendingStatus} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingStatus === "cancelado" ? "Cancelar consulta?" : "Marcar como faltou?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingStatus === "cancelado"
              ? "Esta ação cancelará a consulta. Lançamentos financeiros gerados serão estornados automaticamente."
              : "O paciente será marcado como ausente. Um lançamento de taxa de no-show poderá ser gerado conforme política da clínica."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingStatus(null)}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className={pendingStatus === "cancelado" ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}
            onClick={() => {
              if (pendingStatus) {
                executeStatusChange(pendingStatus);
                setPendingStatus(null);
              }
            }}
          >
            {pendingStatus === "cancelado" ? "Sim, cancelar" : "Sim, marcar faltou"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    </>
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

interface PlanProcedureForAgenda {
  id: number;
  procedureId: number | null;
  procedureName: string | null;
  packageId: number | null;
  packageName: string | null;
}

function CreateAppointmentForm({
  initialDate,
  initialTime,
  initialProcedureId,
  lockProcedure = false,
  scheduleId,
  clinicStart,
  clinicEnd,
  onSuccess,
}: {
  initialDate?: string;
  initialTime?: string;
  initialProcedureId?: number;
  lockProcedure?: boolean;
  scheduleId?: number;
  clinicStart?: string;
  clinicEnd?: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [patientSearch, setPatientSearch] = useState("");

  const { hasRole, hasPermission, user } = useAuth();
  const isProfissional = hasRole("profissional") && !hasPermission("users.manage") && !hasRole("secretaria");
  const canSelectProfessional = hasPermission("users.manage") || hasRole("secretaria");

  const { data: professionals = [] } = useQuery<{ id: number; name: string; roles: string[] }[]>({
    queryKey: ["professionals"],
    queryFn: () => fetch("/api/users/professionals", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: canSelectProfessional,
    select: (data) => data.filter((u) => u.roles.includes("profissional")),
  });

  const [formData, setFormData] = useState(() => {
    const defaultProfessionalId = isProfissional && user ? String((user as any).id ?? "") : "";
    return {
      patientId: "",
      procedureId: initialProcedureId ? String(initialProcedureId) : "",
      date: initialDate || format(new Date(), "yyyy-MM-dd"),
      startTime: initialTime || "",
      notes: "",
      professionalId: defaultProfessionalId,
    };
  });

  useEffect(() => {
    if (canSelectProfessional && professionals.length === 1) {
      setFormData((prev) => ({ ...prev, professionalId: String(professionals[0].id) }));
    }
  }, [professionals, canSelectProfessional]);

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
    const qDigits = q.replace(/\D/g, "");
    return patients.data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.replace(/\D/g, "").includes(qDigits || q)) ||
        (p.cpf && qDigits && p.cpf.replace(/\D/g, "").includes(qDigits))
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

  const { data: planProcedures = [] } = useQuery<PlanProcedureForAgenda[]>({
    queryKey: ["treatment-plan-procedures-agenda", treatmentPlan?.id],
    queryFn: () =>
      fetch(`/api/treatment-plans/${treatmentPlan!.id}/procedures`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!treatmentPlan?.id && treatmentPlan.status === "ativo",
    staleTime: 60_000,
    select: (data) =>
      data.filter((item: PlanProcedureForAgenda) => item.procedureId != null),
  });

  const { data: lastAppointments } = useQuery<{ procedureId: number | null }[]>({
    queryKey: ["last-appointments", formData.patientId],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments?patientId=${formData.patientId}`,
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
    return first?.procedureId ?? null;
  }, [lastAppointments]);

  const selectedProcedure = useMemo(
    () => procedures?.find((p) => p.id === Number(formData.procedureId)),
    [procedures, formData.procedureId]
  );

  const canFetchSlots = !!(formData.date && formData.procedureId);
  const { data: slotsData, isFetching: slotsFetching } = useQuery({
    queryKey: ["available-slots", formData.date, formData.procedureId, scheduleId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: formData.date,
        procedureId: formData.procedureId,
      });
      if (scheduleId) {
        params.set("scheduleId", String(scheduleId));
      } else {
        params.set("clinicStart", clinicStart || "07:00");
        params.set("clinicEnd", clinicEnd || "20:00");
      }
      const res = await fetch(`/api/appointments/available-slots?${params}`, {
        credentials: "include",
      });
      return res.json();
    },
    enabled: canFetchSlots,
    staleTime: 30_000,
  });

  const availableSlots = (slotsData?.slots ?? []) as { time: string; available: boolean; spotsLeft: number }[];
  const isNotWorkingDay = !!(slotsData as any)?.notWorkingDay;

  // Ensure the pre-selected time (from clicking the agenda) is always shown as an option,
  // even if the slots API doesn't include it yet or excludes it
  const slotsWithCurrentTime = useMemo(() => {
    if (!formData.startTime || availableSlots.some((s) => s.time === formData.startTime)) {
      return availableSlots;
    }
    return [{ time: formData.startTime, available: true, spotsLeft: 99 }, ...availableSlots];
  }, [availableSlots, formData.startTime]);

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
    if (canSelectProfessional && professionals.length > 1 && !formData.professionalId) {
      toast({ variant: "destructive", title: "Selecione o profissional atendente." });
      return;
    }

    const professionalIdPayload = canSelectProfessional && formData.professionalId
      ? { professionalId: Number(formData.professionalId) }
      : {};

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
            ...(scheduleId ? { scheduleId } : {}),
            ...professionalIdPayload,
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
          ...(scheduleId ? { scheduleId } : {}),
          ...professionalIdPayload,
        } as any,
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
                    setFormData({
                      ...formData,
                      patientId: p.id.toString(),
                      procedureId: lockProcedure ? formData.procedureId : "",
                    });
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

          {/* ── Data + Horário (always shown first) ── */}
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
                    <div className="h-11 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      {formData.startTime && (
                        <span className="text-xs text-slate-500">{formData.startTime}</span>
                      )}
                    </div>
                  ) : isNotWorkingDay ? (
                    <div className="h-11 rounded-xl border border-amber-200 bg-amber-50 flex items-center justify-center gap-2 px-3">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-700 font-medium">Dia fora do horário desta agenda</span>
                    </div>
                  ) : (
                    <Select value={formData.startTime} onValueChange={(v) => setFormData({ ...formData, startTime: v })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {slotsWithCurrentTime.filter(s => s.available).map((s) => (
                          <SelectItem key={s.time} value={s.time}>
                            {s.time}{s.spotsLeft < 99 ? ` · ${s.spotsLeft} vaga(s)` : ""}
                          </SelectItem>
                        ))}
                        {slotsWithCurrentTime.filter(s => !s.available).length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider border-t border-slate-100 mt-1">Indisponíveis</div>
                            {slotsWithCurrentTime.filter(s => !s.available).map((s) => (
                              <SelectItem key={s.time} value={s.time} disabled>
                                {s.time} · Lotado
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {formData.startTime && computedEndTime && !isNotWorkingDay && (
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

          {/* ── Procedimento ── */}
          {lockProcedure && selectedProcedure ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-violet-200 bg-violet-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-100 text-violet-600">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{selectedProcedure.name}</p>
                <p className="text-xs text-violet-600">
                  {selectedProcedure.durationMinutes} min
                  {selectedProcedure.maxCapacity > 1 ? ` · até ${selectedProcedure.maxCapacity} simultâneos` : ""}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-200 text-violet-700 shrink-0">Sessão em grupo</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Procedimento *</Label>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">

                {/* Plan procedures shown first */}
                {planProcedures.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-1 pt-0.5">
                      <ClipboardList className="w-3 h-3 text-teal-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Do plano de tratamento</span>
                    </div>
                    {planProcedures.map((item) => {
                      const proc = procedures?.find((p) => p.id === item.procedureId);
                      if (!proc) return null;
                      const isSelected = formData.procedureId === proc.id.toString();
                      const isGroup = proc.maxCapacity > 1;
                      return (
                        <button
                          key={`plan-${item.id}`}
                          type="button"
                          onClick={() => setFormData({ ...formData, procedureId: proc.id.toString() })}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-teal-500 bg-teal-50 shadow-sm"
                              : "border-teal-200 bg-teal-50/50 hover:border-teal-400 hover:bg-teal-50"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-teal-500 text-white" : "bg-teal-100 text-teal-600"
                          )}>
                            {isGroup ? <Users className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">{proc.name}</span>
                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                <Sparkles className="w-2.5 h-2.5" /> Plano
                              </span>
                              {lastProcedureId === proc.id && (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  <History className="w-2.5 h-2.5" /> Última sessão
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              {proc.durationMinutes} min
                              {isGroup ? ` · até ${proc.maxCapacity} simultâneos` : ""}
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-teal-500 shrink-0" />}
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1.5 px-1 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outros procedimentos</span>
                    </div>
                  </>
                )}

                {/* All other procedures */}
                {procedures
                  ?.filter((p) => !planProcedures.some((pp) => pp.procedureId === p.id))
                  .map((p) => {
                    const isSelected = formData.procedureId === p.id.toString();
                    const isLast = lastProcedureId === p.id;
                    const isGroup = p.maxCapacity > 1;
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
                          </div>
                          <p className="text-xs text-slate-400">
                            {p.durationMinutes} min
                            {isGroup ? ` · até ${p.maxCapacity} simultâneos` : ""}
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
                  {selectedProcedure.maxCapacity > 1 && ` · até ${selectedProcedure.maxCapacity} simultâneos`}
                </p>
              )}
            </div>
          )}

      {/* Profissional — only for admin/secretary when clinic has multiple professionals */}
      {canSelectProfessional && professionals.length > 1 && (
        <div className="space-y-1.5">
          <Label>Profissional *</Label>
          <Select
            value={formData.professionalId}
            onValueChange={(v) => setFormData({ ...formData, professionalId: v })}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecione o profissional..." />
            </SelectTrigger>
            <SelectContent>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {canSelectProfessional && professionals.length === 1 && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-600">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Profissional: <span className="font-semibold">{professionals[0].name}</span></span>
        </div>
      )}
      {isProfissional && user && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 text-sm text-slate-600">
          <User className="w-4 h-4 text-primary shrink-0" />
          <span>Atendente: <span className="font-semibold text-primary">{(user as any).name ?? "Você"}</span></span>
        </div>
      )}

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

      {/* Recorrência toggle — hidden when adding to an existing session */}
      {!lockProcedure && (
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
      )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
            disabled={!formData.patientId || !formData.procedureId || !formData.startTime || isBusy}
          >
            {isBusy ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {lockProcedure ? "Adicionando..." : isRecurring ? "Criando recorrência..." : "Agendando..."}</>
            ) : lockProcedure ? (
              <><Users className="w-4 h-4 mr-2" /> Adicionar à Sessão</>
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
    compareceu: "bg-teal-400",
    concluido: "bg-slate-400",
    cancelado: "bg-red-400",
    faltou: "bg-orange-400",
    remarcado: "bg-purple-400",
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
                  const isOnline = apt.source === "online";
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

// ─── Block Edit Dialog ────────────────────────────────────────────────────────

function BlockEditDialog({
  block,
  onClose,
  onSuccess,
}: {
  block: BlockedSlot;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: block.date,
    startTime: block.startTime,
    endTime: block.endTime,
    reason: block.reason ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showGroupChoice, setShowGroupChoice] = useState(false);

  const isRecurring = !!block.recurrenceGroupId;
  const dateChanged = form.date !== block.date;

  const doSave = async (updateGroup: boolean) => {
    if (form.startTime >= form.endTime) {
      toast({ variant: "destructive", title: "Horário inválido", description: "O início deve ser anterior ao término." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/blocked-slots/${block.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          reason: form.reason || null,
          updateGroup,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro ao salvar", description: data.message ?? "Tente novamente." });
      } else {
        toast({ title: updateGroup ? "Série inteira atualizada." : "Bloqueio atualizado com sucesso." });
        onSuccess();
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar bloqueio." });
    } finally {
      setIsSaving(false);
      setShowGroupChoice(false);
    }
  };

  const handleSave = () => {
    if (isRecurring && !dateChanged) {
      setShowGroupChoice(true);
    } else {
      doSave(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100">
                <Pencil className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl">Editar Bloqueio</DialogTitle>
                {isRecurring && (
                  <p className="text-xs text-violet-600 font-medium mt-0.5 flex items-center gap-1">
                    <Repeat className="w-3 h-3" /> Bloqueio recorrente
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data</Label>
              <DatePickerPTBR
                value={form.date}
                onChange={(v) => setForm({ ...form, date: v })}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Início</Label>
                <TimeInputPTBR
                  value={form.startTime}
                  onChange={(v) => setForm({ ...form, startTime: v })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Término</Label>
                <TimeInputPTBR
                  value={form.endTime}
                  onChange={(v) => setForm({ ...form, endTime: v })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo</Label>
              <Input
                placeholder="Ex: Almoço, Reunião, Curso..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button className="rounded-xl flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Pencil className="w-4 h-4 mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choice dialog for recurring blocks */}
      {showGroupChoice && (
        <Dialog open onOpenChange={() => setShowGroupChoice(false)}>
          <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar bloqueio recorrente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Este bloqueio faz parte de uma série recorrente. O que deseja atualizar?</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => doSave(false)} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Apenas este bloqueio
              </Button>
              <Button className="rounded-xl" onClick={() => doSave(true)} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Toda a série recorrente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── Blocked Slot Modal ───────────────────────────────────────────────────────

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

function BlockedSlotModal({
  open,
  onOpenChange,
  onSuccess,
  activeSchedules = [],
  defaultScheduleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  activeSchedules?: ScheduleOption[];
  defaultScheduleId?: number;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "12:00",
    endTime: "13:00",
    reason: "",
    scheduleId: null as number | null,
    recurrenceType: "none" as "none" | "daily" | "weekly",
    recurrenceDays: [] as number[],
    recurrenceEndDate: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<{ id: number; groupId: string | null } | null>(null);
  const [editSlot, setEditSlot] = useState<{ id: number; date: string; originalDate: string; startTime: string; endTime: string; reason: string; recurrenceGroupId: string | null } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editShowGroupChoice, setEditShowGroupChoice] = useState(false);

  // On open, auto-set scheduleId based on context
  useEffect(() => {
    if (open) {
      if (defaultScheduleId) {
        setForm(f => ({ ...f, scheduleId: defaultScheduleId }));
      } else if (activeSchedules.length === 1) {
        setForm(f => ({ ...f, scheduleId: activeSchedules[0].id }));
      } else {
        setForm(f => ({ ...f, scheduleId: null }));
      }
    }
  }, [open, defaultScheduleId, activeSchedules]);

  const resolvedScheduleId = form.scheduleId
    ?? (activeSchedules.length === 1 ? activeSchedules[0].id : null);

  const { data: existingBlocks = [], refetch: refetchList } = useQuery<BlockedSlot[]>({
    queryKey: ["blocked-slots-modal", form.date, resolvedScheduleId],
    queryFn: async () => {
      const params = new URLSearchParams({ date: form.date });
      if (resolvedScheduleId) params.set("scheduleId", String(resolvedScheduleId));
      const res = await fetch(`/api/blocked-slots?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: open,
    staleTime: 5_000,
  });

  const isRecurring = form.recurrenceType !== "none";

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(day)
        ? f.recurrenceDays.filter((d) => d !== day)
        : [...f.recurrenceDays, day],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.startTime >= form.endTime) {
      toast({ variant: "destructive", title: "Horário inválido", description: "O horário de início deve ser antes do término." });
      return;
    }
    if (isRecurring && !form.recurrenceEndDate) {
      toast({ variant: "destructive", title: "Data final obrigatória", description: "Informe até quando o bloqueio se repete." });
      return;
    }
    if (isRecurring && form.recurrenceType === "weekly" && form.recurrenceDays.length === 0) {
      toast({ variant: "destructive", title: "Selecione os dias", description: "Marque pelo menos um dia da semana." });
      return;
    }
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        reason: form.reason || undefined,
        recurrenceType: form.recurrenceType,
        scheduleId: resolvedScheduleId ?? undefined,
      };
      if (isRecurring) {
        body.recurrenceEndDate = form.recurrenceEndDate;
        if (form.recurrenceType === "weekly") body.recurrenceDays = form.recurrenceDays;
      }
      const res = await fetch("/api/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erro ao bloquear", description: data.message || "Erro desconhecido." });
      } else {
        const count = data.count || 1;
        toast({
          title: "Horário(s) bloqueado(s)!",
          description: isRecurring
            ? `${count} bloqueio(s) criado(s) com recorrência ${form.recurrenceType === "daily" ? "diária" : "semanal"}`
            : `${form.date} · ${form.startTime}–${form.endTime}`,
        });
        refetchList();
        onSuccess();
        setForm(f => ({ ...f, recurrenceType: "none", recurrenceDays: [], recurrenceEndDate: "" }));
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao bloquear horário." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, groupId: string | null) => {
    if (groupId) {
      setDeleteGroupId({ id, groupId });
      return;
    }
    await doDelete(id, false);
  };

  const doDelete = async (id: number, group: boolean) => {
    try {
      const url = group ? `/api/blocked-slots/${id}?group=true` : `/api/blocked-slots/${id}`;
      await fetch(url, { method: "DELETE", credentials: "include" });
      toast({ title: group ? "Série de bloqueios removida." : "Bloqueio removido." });
      refetchList();
      onSuccess();
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover bloqueio." });
    } finally {
      setDeleteGroupId(null);
    }
  };

  const doSaveEdit = async (updateGroup: boolean) => {
    if (!editSlot) return;
    if (editSlot.startTime >= editSlot.endTime) {
      toast({ variant: "destructive", title: "Horário inválido", description: "O horário de início deve ser anterior ao término." });
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/blocked-slots/${editSlot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: editSlot.date,
          startTime: editSlot.startTime,
          endTime: editSlot.endTime,
          reason: editSlot.reason || null,
          updateGroup,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro ao salvar", description: data.message ?? "Tente novamente." });
      } else {
        toast({ title: updateGroup ? "Série inteira atualizada." : "Bloqueio atualizado com sucesso." });
        setEditSlot(null);
        setEditShowGroupChoice(false);
        refetchList();
        onSuccess();
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar bloqueio." });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editSlot) return;
    const dateChanged = editSlot.date !== editSlot.originalDate;
    if (editSlot.recurrenceGroupId && !dateChanged) {
      setEditShowGroupChoice(true);
    } else {
      doSaveEdit(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
              <DialogTitle className="font-display text-xl">Bloquear Horário</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            {/* Schedule selector — shown only when clinic has multiple active schedules */}
            {activeSchedules.length > 1 && (
              <div className="space-y-1.5">
                <Label>Agenda *</Label>
                <select
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.scheduleId ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, scheduleId: e.target.value ? parseInt(e.target.value) : null }))}
                  required
                >
                  <option value="">Selecione a agenda…</option>
                  {activeSchedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Auto-selected single schedule — display only */}
            {activeSchedules.length === 1 && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600">Agenda: <span className="font-medium text-slate-800">{activeSchedules[0].name}</span></span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Data inicial *</Label>
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

            {/* Recurrence */}
            <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-slate-500" />
                <Label className="text-sm font-semibold text-slate-700">Recorrência</Label>
              </div>
              <div className="flex gap-2">
                {([
                  { value: "none", label: "Uma vez" },
                  { value: "daily", label: "Diário" },
                  { value: "weekly", label: "Semanal" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, recurrenceType: opt.value, recurrenceDays: [] }))}
                    className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${
                      form.recurrenceType === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {form.recurrenceType === "weekly" && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Dias da semana</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEK_DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`w-10 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                          form.recurrenceDays.includes(d.value)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:border-primary"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isRecurring && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Repetir até *</Label>
                  <DatePickerPTBR
                    value={form.recurrenceEndDate}
                    onChange={(v) => setForm({ ...form, recurrenceEndDate: v })}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {isRecurring ? "Criar bloqueios recorrentes" : "Bloquear horário"}
            </Button>
          </form>

          {/* Existing blocks for the selected date */}
          {existingBlocks.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Bloqueios neste dia
              </p>
              <div className="space-y-1.5">
                {existingBlocks.map((b) => {
                  const schedName = b.scheduleId
                    ? activeSchedules.find((s) => s.id === b.scheduleId)?.name
                    : null;
                  return (
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
                      {schedName && (
                        <span className="text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded shrink-0">
                          {schedName}
                        </span>
                      )}
                      {b.recurrenceGroupId && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded shrink-0">
                          Recorrente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                        onClick={() => setEditSlot({ id: b.id, date: b.date, originalDate: b.date, startTime: b.startTime, endTime: b.endTime, reason: b.reason ?? "", recurrenceGroupId: b.recurrenceGroupId ?? null })}
                        title="Editar bloqueio"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                        onClick={() => handleDelete(b.id, b.recurrenceGroupId || null)}
                        title="Remover bloqueio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete group confirmation */}
      {deleteGroupId && (
        <Dialog open onOpenChange={() => setDeleteGroupId(null)}>
          <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Remover bloqueio recorrente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Este bloqueio faz parte de uma série recorrente. O que deseja remover?</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => doDelete(deleteGroupId.id, false)}>
                Apenas este bloqueio
              </Button>
              <Button variant="destructive" className="rounded-xl" onClick={() => doDelete(deleteGroupId.id, true)}>
                Toda a série recorrente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit blocked slot dialog */}
      {editSlot && (
        <Dialog open onOpenChange={() => setEditSlot(null)}>
          <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100">
                  <Pencil className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <DialogTitle className="font-display text-lg">Editar Bloqueio</DialogTitle>
                  {editSlot.recurrenceGroupId && (
                    <p className="text-xs text-violet-600 font-medium mt-0.5 flex items-center gap-1">
                      <Repeat className="w-3 h-3" /> Bloqueio recorrente
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data</Label>
                <DatePickerPTBR
                  value={editSlot.date}
                  onChange={(v) => setEditSlot({ ...editSlot, date: v })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Início</Label>
                  <TimeInputPTBR
                    value={editSlot.startTime}
                    onChange={(v) => setEditSlot({ ...editSlot, startTime: v })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Término</Label>
                  <TimeInputPTBR
                    value={editSlot.endTime}
                    onChange={(v) => setEditSlot({ ...editSlot, endTime: v })}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Motivo</Label>
                <Input
                  placeholder="Ex: Almoço, Reunião..."
                  value={editSlot.reason}
                  onChange={(e) => setEditSlot({ ...editSlot, reason: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" className="rounded-xl flex-1" onClick={() => setEditSlot(null)} disabled={isSavingEdit}>
                Cancelar
              </Button>
              <Button className="rounded-xl flex-1" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Pencil className="w-4 h-4 mr-1.5" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Recurring series update choice dialog */}
      {editShowGroupChoice && editSlot && (
        <Dialog open onOpenChange={() => setEditShowGroupChoice(false)}>
          <DialogContent className="sm:max-w-[380px] border-none shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar bloqueio recorrente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Este bloqueio faz parte de uma série recorrente. O que deseja atualizar?</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => doSaveEdit(false)} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Apenas este bloqueio
              </Button>
              <Button className="rounded-xl" onClick={() => doSaveEdit(true)} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Toda a série recorrente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
