import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  Calendar,
  User2,
  Building2,
  Power,
  PowerOff,
  CalendarDays,
  Loader2,
} from "lucide-react";

const DAYS_OF_WEEK = [
  { value: "0", label: "Dom", fullLabel: "Domingo" },
  { value: "1", label: "Seg", fullLabel: "Segunda-feira" },
  { value: "2", label: "Ter", fullLabel: "Terça-feira" },
  { value: "3", label: "Qua", fullLabel: "Quarta-feira" },
  { value: "4", label: "Qui", fullLabel: "Quinta-feira" },
  { value: "5", label: "Sex", fullLabel: "Sexta-feira" },
  { value: "6", label: "Sáb", fullLabel: "Sábado" },
];

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#06b6d4",
];

interface Professional {
  id: number;
  name: string;
  email: string;
}

interface Schedule {
  id: number;
  clinicId: number;
  name: string;
  description: string | null;
  type: string;
  professionalId: number | null;
  professional: Professional | null;
  workingDays: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  description: string;
  type: string;
  professionalId: string;
  workingDays: string[];
  startTime: string;
  endTime: string;
  slotDurationMinutes: string;
  color: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  type: "clinic",
  professionalId: "",
  workingDays: ["1", "2", "3", "4", "5"],
  startTime: "08:00",
  endTime: "18:00",
  slotDurationMinutes: "30",
  color: "#6366f1",
};

function fetchSchedules(): Promise<Schedule[]> {
  return fetch("/api/schedules").then((r) => r.json());
}

function fetchUsers(): Promise<Professional[]> {
  return fetch("/api/users").then((r) => r.json());
}

function parseDays(workingDays: string): string[] {
  if (!workingDays) return [];
  return workingDays.split(",").map((d) => d.trim()).filter(Boolean);
}

function formatDaysBadges(workingDays: string) {
  const days = parseDays(workingDays);
  return DAYS_OF_WEEK.filter((d) => days.includes(d.value));
}

export default function AgendasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const { data: users = [] } = useQuery<Professional[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const professionals = users.filter((u: any) =>
    (u.roles ?? []).includes("profissional") || (u.roles ?? []).includes("admin")
  );

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Erro ao criar agenda");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setDialogOpen(false);
      toast({ title: "Agenda criada com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Erro ao atualizar agenda");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setDialogOpen(false);
      toast({ title: "Agenda atualizada com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setDeleteTarget(null);
      toast({ title: "Agenda removida." });
    },
    onError: () => toast({ title: "Erro ao remover agenda", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(s: Schedule) {
    setEditTarget(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      type: s.type,
      professionalId: s.professionalId ? String(s.professionalId) : "",
      workingDays: parseDays(s.workingDays),
      startTime: s.startTime,
      endTime: s.endTime,
      slotDurationMinutes: String(s.slotDurationMinutes),
      color: s.color,
    });
    setDialogOpen(true);
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter((d) => d !== day)
        : [...f.workingDays, day],
    }));
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (form.workingDays.length === 0) {
      toast({ title: "Selecione ao menos um dia de funcionamento", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      professionalId: form.type === "professional" && form.professionalId ? parseInt(form.professionalId) : null,
      workingDays: form.workingDays.map(Number),
      startTime: form.startTime,
      endTime: form.endTime,
      slotDurationMinutes: parseInt(form.slotDurationMinutes),
      color: form.color,
    };

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout title="Agendas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agendas</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure as agendas da sua clínica — gerais ou vinculadas a profissionais.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Agenda
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-muted rounded-full p-4 mb-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhuma agenda configurada</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm">
              Crie agendas para organizar os horários da sua clínica e dos profissionais.
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira agenda
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onEdit={() => openEdit(schedule)}
                onDelete={() => setDeleteTarget(schedule)}
                onToggle={() => toggleMutation.mutate({ id: schedule.id, isActive: !schedule.isActive })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Agenda" : "Nova Agenda"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome da agenda *</Label>
              <Input
                placeholder="Ex: Agenda Geral, Fisioterapia, Dr. Silva..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição opcional..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Tipo de agenda</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, professionalId: "" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Geral da clínica
                    </div>
                  </SelectItem>
                  <SelectItem value="professional">
                    <div className="flex items-center gap-2">
                      <User2 className="h-4 w-4" />
                      Vinculada a profissional
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Professional selector */}
            {form.type === "professional" && (
              <div className="space-y-1.5">
                <Label>Profissional</Label>
                <Select value={form.professionalId} onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um profissional" />
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

            {/* Working days */}
            <div className="space-y-2">
              <Label>Dias de funcionamento</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map((day) => {
                  const active = form.workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                        ${active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Término</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Slot duration */}
            <div className="space-y-1.5">
              <Label>Duração do slot (minutos)</Label>
              <Select
                value={form.slotDurationMinutes}
                onValueChange={(v) => setForm((f) => ({ ...f, slotDurationMinutes: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                  <SelectItem value="90">90 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Cor da agenda</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editTarget ? "Salvar alterações" : "Criar agenda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agenda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a agenda <strong>{deleteTarget?.name}</strong>?
              Os agendamentos existentes não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onToggle,
}: {
  schedule: Schedule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const days = formatDaysBadges(schedule.workingDays);

  return (
    <div
      className={`relative rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md ${
        !schedule.isActive ? "opacity-60" : ""
      }`}
    >
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: schedule.color }} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{schedule.name}</h3>
            {schedule.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{schedule.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Type badge */}
        <div className="flex items-center gap-2">
          {schedule.type === "professional" ? (
            <Badge variant="secondary" className="gap-1 text-xs">
              <User2 className="h-3 w-3" />
              {schedule.professional?.name ?? "Profissional"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs">
              <Building2 className="h-3 w-3" />
              Geral da clínica
            </Badge>
          )}
        </div>

        {/* Working hours */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{schedule.startTime} – {schedule.endTime}</span>
          <span className="text-border">·</span>
          <span>{schedule.slotDurationMinutes} min/slot</span>
        </div>

        {/* Working days */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {days.length === 7 ? (
              <span className="font-medium text-foreground">Todos os dias</span>
            ) : days.length === 0 ? (
              <span className="text-destructive">Nenhum dia selecionado</span>
            ) : (
              days.map((d) => (
                <span key={d.value} className="font-medium text-foreground">{d.label}</span>
              ))
            )}
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {schedule.isActive ? (
              <Power className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" />
            )}
            <span className={schedule.isActive ? "text-green-600 font-medium" : ""}>
              {schedule.isActive ? "Ativa" : "Inativa"}
            </span>
          </div>
          <Switch
            checked={schedule.isActive}
            onCheckedChange={onToggle}
            className="scale-75"
          />
        </div>
      </div>
    </div>
  );
}
