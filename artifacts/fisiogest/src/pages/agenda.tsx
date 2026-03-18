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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { DatePickerPTBR, TimeInputPTBR } from "@/components/ui/date-picker-ptbr";

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; badge: string }> = {
  agendado:  { label: "Agendado",   color: "bg-blue-50",   border: "border-blue-400",   badge: "bg-blue-100 text-blue-700" },
  confirmado:{ label: "Confirmado", color: "bg-green-50",  border: "border-green-500",  badge: "bg-green-100 text-green-700" },
  concluido: { label: "Concluído",  color: "bg-slate-50",  border: "border-slate-400",  badge: "bg-slate-100 text-slate-600" },
  cancelado: { label: "Cancelado",  color: "bg-red-50",    border: "border-red-400",    badge: "bg-red-100 text-red-700" },
  faltou:    { label: "Faltou",     color: "bg-orange-50", border: "border-orange-400", badge: "bg-orange-100 text-orange-700" },
};

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

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

  const getAppointmentsForSlot = (date: Date, time: string) => {
    if (!appointments) return [];
    const hourStr = time.split(":")[0];
    return appointments.filter(
      (a) => a.date === format(date, "yyyy-MM-dd") && a.startTime.startsWith(hourStr)
    );
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
                    const slotApps = getAppointmentsForSlot(day, hour);
                    return (
                      <div
                        key={j}
                        className={`p-2 border-r border-slate-100 min-h-[100px] cursor-pointer hover:bg-slate-50 transition-colors relative group ${isSameDay(day, new Date()) ? "bg-primary/[0.02]" : ""}`}
                        onClick={() => handleSlotClick(day, hour)}
                      >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Plus className="w-6 h-6 text-primary/50" />
                        </div>
                        {slotApps.map((apt) => {
                          const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.agendado;
                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                              className={`relative z-10 p-2 mb-2 rounded-lg text-xs shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow ${cfg.color} ${cfg.border}`}
                            >
                              <p className="font-bold truncate">{apt.patient?.name}</p>
                              <p className="opacity-80 truncate">{apt.procedure?.name}</p>
                              <p className="text-[10px] mt-1 font-medium">{apt.startTime} - {apt.endTime}</p>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </div>
                          );
                        })}
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

      {/* Appointment detail/edit modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={() => { refetch(); setSelectedAppointment(null); }}
        />
      )}
    </AppLayout>
  );
}

// ─── Appointment Detail Modal ─────────────────────────────────────────────────

function AppointmentDetailModal({
  appointment,
  onClose,
  onRefresh,
}: {
  appointment: any;
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
          {/* Info summary */}
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

          {/* Quick status actions */}
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

          {/* Edit form */}
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

          {/* Footer actions */}
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
  onSuccess,
}: {
  initialDate?: string;
  initialTime?: string;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    patientId: "",
    procedureId: "",
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
            {(selectedProcedure as any).maxCapacity > 1
              ? ` · Capacidade: ${(selectedProcedure as any).maxCapacity} vagas`
              : ""}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Data *</Label>
        <DatePickerPTBR
          value={formData.date}
          onChange={(v) => setFormData({ ...formData, date: v, startTime: "" })}
          className="h-12 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label>
          Horário *
          {slotsFetching && <span className="ml-2 text-xs text-slate-400">Verificando disponibilidade...</span>}
        </Label>
        {canFetchSlots && availableSlots.length > 0 ? (
          <Select
            value={formData.startTime}
            onValueChange={(v) => setFormData({ ...formData, startTime: v })}
          >
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Selecione um horário disponível..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {availableSlots.map((slot) => (
                <SelectItem key={slot.time} value={slot.time} disabled={!slot.available}>
                  {slot.time}
                  {!slot.available
                    ? " — lotado"
                    : (slotsData?.procedure?.maxCapacity ?? 1) > 1
                    ? ` — ${slot.spotsLeft} vaga${slot.spotsLeft !== 1 ? "s" : ""} livre${slot.spotsLeft !== 1 ? "s" : ""}`
                    : " — disponível"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <TimeInputPTBR
            value={formData.startTime}
            onChange={(v) => setFormData({ ...formData, startTime: v })}
            className="h-12 rounded-xl"
            required
          />
        )}
        {formData.startTime && computedEndTime && (
          <p className="text-xs text-slate-500 flex items-center gap-1 pl-1">
            <Clock className="w-3 h-3" />
            Término calculado: <span className="font-semibold text-slate-700">{computedEndTime}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Informações adicionais sobre a consulta..."
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20"
          disabled={mutation.isPending || !formData.patientId || !formData.procedureId || !formData.startTime}
        >
          {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Agendamento"}
        </Button>
      </div>
    </form>
  );
}
