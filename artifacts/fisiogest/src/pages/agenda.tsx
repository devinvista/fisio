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
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Users,
  ChevronRight as Arrow,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { DatePickerPTBR, TimeInputPTBR } from "@/components/ui/date-picker-ptbr";

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; badge: string; dot: string }> = {
  agendado:   { label: "Agendado",   color: "bg-blue-50",   border: "border-blue-400",   badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-400" },
  confirmado: { label: "Confirmado", color: "bg-green-50",  border: "border-green-500",  badge: "bg-green-100 text-green-700",   dot: "bg-green-500" },
  concluido:  { label: "Concluído",  color: "bg-slate-50",  border: "border-slate-400",  badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
  cancelado:  { label: "Cancelado",  color: "bg-red-50",    border: "border-red-400",    badge: "bg-red-100 text-red-700",       dot: "bg-red-400" },
  faltou:     { label: "Faltou",     color: "bg-orange-50", border: "border-orange-400", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
};

type Appointment = NonNullable<ReturnType<typeof useListAppointments>["data"]>[number];

type SlotGroup = {
  procedureId: number;
  procedureName: string;
  appointments: Appointment[];
};

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; procedureId?: number } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SlotGroup | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i));

  const startDateStr = format(weekDays[0], "yyyy-MM-dd");
  const endDateStr = format(weekDays[5], "yyyy-MM-dd");

  const { data: appointments, isLoading, refetch } = useListAppointments({ startDate: startDateStr, endDate: endDateStr });

  const hours = Array.from({ length: 11 }).map((_, i) => `${String(i + 8).padStart(2, "0")}:00`);

  const handleSlotClick = (date: Date, time: string) => {
    setSelectedSlot({ date: format(date, "yyyy-MM-dd"), time });
    setIsNewModalOpen(true);
  };

  const getGroupedSlots = (date: Date, time: string): SlotGroup[] => {
    if (!appointments) return [];
    const hourStr = time.split(":")[0];
    const slotApps = appointments.filter(
      (a) => a.date === format(date, "yyyy-MM-dd") && a.startTime.startsWith(hourStr)
    );
    const byProcedure = new Map<number, SlotGroup>();
    for (const apt of slotApps) {
      const pid = apt.procedure?.id ?? 0;
      if (!byProcedure.has(pid)) {
        byProcedure.set(pid, {
          procedureId: pid,
          procedureName: apt.procedure?.name ?? "Procedimento",
          appointments: [],
        });
      }
      byProcedure.get(pid)!.appointments.push(apt);
    }
    return Array.from(byProcedure.values());
  };

  const handleRefresh = () => {
    refetch();
    setSelectedAppointment(null);
    setSelectedGroup(null);
  };

  return (
    <AppLayout title="Agenda Semanal">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 font-display font-bold text-lg min-w-[150px] justify-center">
            <CalIcon className="w-5 h-5 text-primary" />
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" className="ml-2 rounded-xl" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
        </div>

        <Button
          onClick={() => { setSelectedSlot(null); setIsNewModalOpen(true); }}
          className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <Card className="border-none shadow-xl bg-white overflow-x-auto rounded-3xl">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
            <div className="p-4 border-r border-slate-200 text-center text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center">
              Hora
            </div>
            {weekDays.map((day, i) => (
              <div key={i} className={`p-4 border-r border-slate-200 text-center ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-2xl font-bold mt-1 ${isSameDay(day, new Date()) ? "text-primary" : "text-slate-800"}`}>
                  {format(day, "dd")}
                </p>
              </div>
            ))}
          </div>

          {/* Body */}
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="relative">
              {hours.map((hour, i) => (
                <div key={i} className="grid grid-cols-7 border-b border-slate-100">
                  <div className="p-4 border-r border-slate-200 text-center text-sm font-medium text-slate-500 bg-slate-50/30">
                    {hour}
                  </div>
                  {weekDays.map((day, j) => {
                    const groups = getGroupedSlots(day, hour);
                    return (
                      <div
                        key={j}
                        className={`p-1.5 border-r border-slate-100 min-h-[90px] cursor-pointer hover:bg-slate-50 transition-colors relative group ${isSameDay(day, new Date()) ? "bg-primary/[0.02]" : ""}`}
                        onClick={() => handleSlotClick(day, hour)}
                      >
                        {groups.length === 0 && (
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Plus className="w-5 h-5 text-primary/40" />
                          </div>
                        )}

                        {groups.map((group) =>
                          group.appointments.length === 1 ? (
                            <SingleAppointmentCard
                              key={group.procedureId}
                              appointment={group.appointments[0]}
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointment(group.appointments[0]); }}
                            />
                          ) : (
                            <GroupAppointmentCard
                              key={group.procedureId}
                              group={group}
                              onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                            />
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* New appointment modal */}
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

      {/* Single appointment detail modal */}
      {selectedAppointment && !selectedGroup && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={handleRefresh}
        />
      )}

      {/* Group slot modal */}
      {selectedGroup && (
        <GroupSlotModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onRefresh={handleRefresh}
          onOpenAppointment={(apt) => { setSelectedGroup(null); setSelectedAppointment(apt); }}
          onAddPatient={(date, time, procedureId) => {
            setSelectedGroup(null);
            setSelectedSlot({ date, time, procedureId });
            setIsNewModalOpen(true);
          }}
        />
      )}
    </AppLayout>
  );
}

// ─── Single Appointment Card ──────────────────────────────────────────────────

function SingleAppointmentCard({ appointment, onClick }: { appointment: Appointment; onClick: (e: React.MouseEvent) => void }) {
  const cfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.agendado;
  return (
    <div
      onClick={onClick}
      className={`relative z-10 p-2 mb-1.5 rounded-lg text-xs shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-all ${cfg.color} ${cfg.border}`}
    >
      <p className="font-bold truncate leading-tight">{appointment.patient?.name}</p>
      <p className="opacity-70 truncate text-[10px] mt-0.5">{appointment.procedure?.name}</p>
      <p className="text-[10px] mt-1 font-medium opacity-60">{appointment.startTime} – {appointment.endTime}</p>
      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.badge}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Group Appointment Card ───────────────────────────────────────────────────

function GroupAppointmentCard({ group, onClick }: { group: SlotGroup; onClick: (e: React.MouseEvent) => void }) {
  const { appointments, procedureName } = group;
  const firstApt = appointments[0];
  const cfg = STATUS_CONFIG[firstApt.status] || STATUS_CONFIG.agendado;

  const statusCounts = appointments.reduce((acc, apt) => {
    acc[apt.status] = (acc[apt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const shownNames = appointments.slice(0, 2).map((a) => a.patient?.name?.split(" ")[0] ?? "—");
  const extraCount = appointments.length - 2;

  return (
    <div
      onClick={onClick}
      className={`relative z-10 p-2 mb-1.5 rounded-lg text-xs shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-all ${cfg.color} ${cfg.border}`}
    >
      {/* Procedure name + count */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <p className="font-bold truncate leading-tight flex-1">{procedureName}</p>
        <span className="flex items-center gap-0.5 bg-white/70 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shrink-0">
          <Users className="w-2.5 h-2.5" />
          {appointments.length}
        </span>
      </div>

      {/* Patient names */}
      <p className="text-[10px] opacity-70 truncate">
        {shownNames.join(", ")}
        {extraCount > 0 && ` +${extraCount}`}
      </p>

      {/* Time */}
      <p className="text-[10px] mt-1 font-medium opacity-60">{firstApt.startTime} – {firstApt.endTime}</p>

      {/* Status dots */}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {Object.entries(statusCounts).map(([status, count]) => {
          const c = STATUS_CONFIG[status];
          return (
            <span key={status} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${c.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {count} {c.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Slot Modal ─────────────────────────────────────────────────────────

function GroupSlotModal({
  group,
  onClose,
  onRefresh,
  onOpenAppointment,
  onAddPatient,
}: {
  group: SlotGroup;
  onClose: () => void;
  onRefresh: () => void;
  onOpenAppointment: (apt: Appointment) => void;
  onAddPatient: (date: string, time: string, procedureId: number) => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateAppointment();
  const completeMutation = useCompleteAppointment();

  const firstApt = group.appointments[0];

  const handleStatusChange = (apt: Appointment, newStatus: string) => {
    updateMutation.mutate(
      { id: apt.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: `${apt.patient?.name}: status alterado para "${STATUS_CONFIG[newStatus]?.label}".` });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao alterar status." }),
      }
    );
  };

  const handleComplete = (apt: Appointment) => {
    completeMutation.mutate(
      { id: apt.id },
      {
        onSuccess: () => {
          toast({ title: `${apt.patient?.name}: consulta concluída!` });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao concluir consulta." }),
      }
    );
  };

  const isBusy = updateMutation.isPending || completeMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">{group.procedureName}</DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {firstApt.startTime} – {firstApt.endTime}
                <span className="mx-1">·</span>
                {firstApt.date ? format(new Date(firstApt.date + "T12:00:00"), "dd/MM/yyyy") : ""}
                <span className="mx-1">·</span>
                <strong>{group.appointments.length} pacientes</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {group.appointments.map((apt) => {
            const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.agendado;
            return (
              <div
                key={apt.id}
                className={`rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden`}
              >
                {/* Patient header */}
                <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{apt.patient?.name}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 px-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10"
                    onClick={() => onOpenAppointment(apt)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Detalhes
                    <Arrow className="w-3 h-3 ml-1" />
                  </Button>
                </div>

                {/* Quick actions */}
                {apt.status !== "concluido" && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {apt.status !== "confirmado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 rounded-lg text-[11px] border-green-200 text-green-700 hover:bg-green-50"
                        onClick={() => handleStatusChange(apt, "confirmado")}
                        disabled={isBusy}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" /> Confirmar
                      </Button>
                    )}
                    {apt.status !== "faltou" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 rounded-lg text-[11px] border-orange-200 text-orange-700 hover:bg-orange-50"
                        onClick={() => handleStatusChange(apt, "faltou")}
                        disabled={isBusy}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" /> Faltou
                      </Button>
                    )}
                    {apt.status !== "cancelado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 rounded-lg text-[11px] border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => handleStatusChange(apt, "cancelado")}
                        disabled={isBusy}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 px-2.5 rounded-lg text-[11px] bg-primary hover:bg-primary/90"
                      onClick={() => handleComplete(apt)}
                      disabled={isBusy}
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      Concluir
                    </Button>
                  </div>
                )}
                {apt.status === "concluido" && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-slate-400 italic">Consulta concluída</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add patient to same slot */}
        <div className="pt-3 border-t border-slate-100">
          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary/60"
            onClick={() => onAddPatient(firstApt.date, firstApt.startTime, group.procedureId)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar paciente neste horário
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

  const handleUpdate = () => {
    updateMutation.mutate(
      { id: appointment.id, data: editForm },
      {
        onSuccess: () => {
          toast({ title: "Consulta atualizada com sucesso." });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao atualizar consulta." }),
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id: appointment.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: `Status alterado para "${STATUS_CONFIG[newStatus]?.label || newStatus}".` });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao alterar status." }),
      }
    );
  };

  const handleComplete = () => {
    completeMutation.mutate(
      { id: appointment.id },
      {
        onSuccess: () => {
          toast({ title: "Consulta concluída!", description: "Registro financeiro gerado automaticamente." });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao concluir consulta." }),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Tem certeza que deseja excluir esta consulta?")) return;
    deleteMutation.mutate(
      { id: appointment.id },
      {
        onSuccess: () => {
          toast({ title: "Consulta excluída." });
          onRefresh();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao excluir consulta." }),
      }
    );
  };

  const isBusy = updateMutation.isPending || deleteMutation.isPending || completeMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <CalIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">Detalhes da Consulta</DialogTitle>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Paciente</p>
                <p className="font-semibold text-slate-800">{appointment.patient?.name}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Procedimento</p>
                <p className="font-semibold text-slate-800">{appointment.procedure?.name}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Data e Horário</p>
                <p className="font-semibold text-slate-800">
                  {appointment.date ? format(new Date(appointment.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}{" "}
                  · {appointment.startTime} – {appointment.endTime}
                </p>
              </div>
            </div>
            {appointment.notes && (
              <>
                <Separator />
                <p className="text-xs text-slate-500">Observações</p>
                <p className="text-sm text-slate-700">{appointment.notes}</p>
              </>
            )}
          </div>

          {!isEditing && appointment.status !== "concluido" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {appointment.status !== "confirmado" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handleStatusChange("confirmado")} disabled={isBusy}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Confirmar
                  </Button>
                )}
                {appointment.status !== "faltou" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => handleStatusChange("faltou")} disabled={isBusy}>
                    <AlertCircle className="w-4 h-4 mr-1" /> Faltou
                  </Button>
                )}
                {appointment.status !== "cancelado" && (
                  <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleStatusChange("cancelado")} disabled={isBusy}>
                    <XCircle className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                )}
                <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90"
                  onClick={handleComplete} disabled={isBusy}>
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Concluir
                </Button>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Editar Consulta</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <DatePickerPTBR
                    value={editForm.date}
                    onChange={(v) => setEditForm({ ...editForm, date: v })}
                    className="rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário</Label>
                  <TimeInputPTBR
                    value={editForm.startTime}
                    onChange={(v) => setEditForm({ ...editForm, startTime: v })}
                    className="rounded-xl h-10"
                  />
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
                <Textarea value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="rounded-xl resize-none" rows={2} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="rounded-xl flex-1" onClick={handleUpdate} disabled={isBusy}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
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
        `/api/appointments/available-slots?date=${formData.date}&procedureId=${formData.procedureId}&clinicStart=08:00&clinicEnd=18:00`
      );
      return res.json();
    },
    enabled: canFetchSlots,
    staleTime: 30_000,
  });

  const availableSlots = (slotsData?.slots ?? []) as {
    time: string;
    available: boolean;
    spotsLeft: number;
  }[];

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
    <form onSubmit={handleSubmit} className="space-y-5 pt-4">
      <div className="space-y-2">
        <Label>Paciente *</Label>
        <Select value={formData.patientId} onValueChange={(v) => setFormData({ ...formData, patientId: v })}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder="Selecione o paciente..." />
          </SelectTrigger>
          <SelectContent>
            {patients?.data?.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Procedimento *</Label>
        <Select
          value={formData.procedureId}
          onValueChange={(v) => setFormData({ ...formData, procedureId: v, startTime: "" })}
        >
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder="Selecione o procedimento..." />
          </SelectTrigger>
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
            Duração: {selectedProcedure.durationMinutes} min
            {(selectedProcedure as any).maxCapacity > 1 && ` · até ${(selectedProcedure as any).maxCapacity} pacientes simultâneos`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data *</Label>
          <DatePickerPTBR
            value={formData.date}
            onChange={(v) => setFormData({ ...formData, date: v, startTime: "" })}
            className="h-12 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label>Horário *</Label>
          {canFetchSlots ? (
            <div>
              {slotsFetching ? (
                <div className="h-12 rounded-xl border border-slate-200 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : (
                <Select value={formData.startTime} onValueChange={(v) => setFormData({ ...formData, startTime: v })}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((s) => (
                      <SelectItem
                        key={s.time}
                        value={s.time}
                        disabled={!s.available}
                      >
                        {s.time}
                        {s.available
                          ? s.spotsLeft < 99 ? ` · ${s.spotsLeft} vaga(s)` : ""
                          : " · Lotado"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {formData.startTime && computedEndTime && (
                <p className="text-xs text-slate-500 mt-1 pl-1">
                  Término: {computedEndTime}
                </p>
              )}
            </div>
          ) : (
            <TimeInputPTBR
              value={formData.startTime}
              onChange={(v) => setFormData({ ...formData, startTime: v })}
              className="h-12 rounded-xl"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
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
        className="w-full h-12 rounded-xl shadow-lg shadow-primary/20"
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
