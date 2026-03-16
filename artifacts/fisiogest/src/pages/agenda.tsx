import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useListAppointments, useListPatients, useListProcedures, useCreateAppointment } from "@workspace/api-client-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string} | null>(null);
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)); // Mon-Sat
  
  const startDateStr = format(weekDays[0], "yyyy-MM-dd");
  const endDateStr = format(weekDays[5], "yyyy-MM-dd");
  
  const { data: appointments, isLoading, refetch } = useListAppointments({ startDate: startDateStr, endDate: endDateStr });

  const hours = Array.from({ length: 11 }).map((_, i) => `${i + 8}:00`); // 08:00 to 18:00

  const handleSlotClick = (date: Date, time: string) => {
    setSelectedSlot({ date: format(date, "yyyy-MM-dd"), time });
    setIsNewModalOpen(true);
  };

  const getAppointmentsForSlot = (date: Date, time: string) => {
    if (!appointments) return [];
    return appointments.filter(a => a.date === format(date, "yyyy-MM-dd") && a.startTime.startsWith(time.split(':')[0]));
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
        
        <Button onClick={() => { setSelectedSlot(null); setIsNewModalOpen(true); }} className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <Card className="border-none shadow-xl bg-white overflow-x-auto rounded-3xl">
        <div className="min-w-[800px]">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
            <div className="p-4 border-r border-slate-200 text-center text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center">
              Hora
            </div>
            {weekDays.map((day, i) => (
              <div key={i} className={`p-4 border-r border-slate-200 text-center ${isSameDay(day, new Date()) ? 'bg-primary/5' : ''}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-2xl font-bold mt-1 ${isSameDay(day, new Date()) ? 'text-primary' : 'text-slate-800'}`}>
                  {format(day, "dd")}
                </p>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {isLoading ? (
            <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
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
                        className={`p-2 border-r border-slate-100 min-h-[100px] cursor-pointer hover:bg-slate-50 transition-colors relative group ${isSameDay(day, new Date()) ? 'bg-primary/[0.02]' : ''}`}
                        onClick={() => handleSlotClick(day, hour)}
                      >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-6 h-6 text-primary/50" />
                        </div>
                        {slotApps.map(apt => (
                          <div 
                            key={apt.id} 
                            onClick={(e) => e.stopPropagation()} 
                            className={`relative z-10 p-2 mb-2 rounded-lg text-xs shadow-sm border-l-4 status-${apt.status}`}
                          >
                            <p className="font-bold truncate">{apt.patient?.name}</p>
                            <p className="opacity-80 truncate">{apt.procedure?.name}</p>
                            <p className="text-[10px] mt-1 font-medium">{apt.startTime} - {apt.endTime}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

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
    </AppLayout>
  );
}

function CreateAppointmentForm({ initialDate, initialTime, onSuccess }: { initialDate?: string, initialTime?: string, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    patientId: "",
    procedureId: "",
    date: initialDate || format(new Date(), "yyyy-MM-dd"),
    startTime: initialTime || "08:00"
  });

  const { data: patients } = useListPatients({ limit: 1000 });
  const { data: procedures } = useListProcedures();
  const mutation = useCreateAppointment();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      data: {
        patientId: Number(formData.patientId),
        procedureId: Number(formData.procedureId),
        date: formData.date,
        startTime: formData.startTime
      }
    }, {
      onSuccess: () => {
        toast({ title: "Agendado!", description: "Consulta marcada com sucesso." });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro", description: err.message || "Conflito de horário." });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4">
      <div className="space-y-2">
        <Label>Paciente *</Label>
        <Select value={formData.patientId} onValueChange={v => setFormData({...formData, patientId: v})}>
          <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione o paciente..." /></SelectTrigger>
          <SelectContent>
            {patients?.data?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Procedimento *</Label>
        <Select value={formData.procedureId} onValueChange={v => setFormData({...formData, procedureId: v})}>
          <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione o procedimento..." /></SelectTrigger>
          <SelectContent>
            {procedures?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.durationMinutes} min)</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Horário *</Label>
          <Input type="time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="h-12 rounded-xl" />
        </div>
      </div>

      <div className="pt-4">
        <Button type="submit" className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20" disabled={mutation.isPending || !formData.patientId || !formData.procedureId}>
          {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Agendamento"}
        </Button>
      </div>
    </form>
  );
}
