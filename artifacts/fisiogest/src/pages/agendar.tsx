import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Phone,
  Mail,
  FileText,
  XCircle,
  AlertCircle,
  Dumbbell,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { format, addDays, isBefore, startOfToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import LogoMark from "@/components/logo-mark";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatDateBR(isoDate: string) {
  try {
    return format(parseISO(isoDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicProcedure {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: string;
  description?: string | null;
  maxCapacity: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  spotsLeft: number;
}

interface BookingConfirmation {
  bookingToken: string;
  appointment: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    procedure: {
      name: string;
      durationMinutes: number;
      price: string;
    };
  };
}

interface BookingDetails {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  bookingToken: string;
  patient: { name: string; phone: string; email?: string | null } | null;
  procedure: { id: number; name: string; durationMinutes: number; price: string } | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Fisioterapia": "🦴",
  "Pilates": "🤸",
  "Estética": "✨",
  "Acupuntura": "📍",
  "Massagem": "💆",
  "default": "🏥",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  agendado: { label: "Agendado", color: "text-blue-700 bg-blue-100" },
  confirmado: { label: "Confirmado", color: "text-green-700 bg-green-100" },
  concluido: { label: "Concluído", color: "text-slate-700 bg-slate-100" },
  cancelado: { label: "Cancelado", color: "text-red-700 bg-red-100" },
  faltou: { label: "Faltou", color: "text-amber-700 bg-amber-100" },
};

// ── Step indicators ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = [
    { label: "Procedimento", icon: <Dumbbell className="w-4 h-4" /> },
    { label: "Data e Hora", icon: <Calendar className="w-4 h-4" /> },
    { label: "Seus Dados", icon: <User className="w-4 h-4" /> },
    { label: "Confirmação", icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const idx = i + 1;
        const isActive = idx === step;
        const isDone = idx < step;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center gap-1.5 ${i < total - 1 ? "flex-1" : ""}`}>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isDone ? "bg-primary text-white" : isActive ? "bg-primary text-white ring-4 ring-primary/20" : "bg-slate-100 text-slate-400"}`}
              >
                {isDone ? <Check className="w-4 h-4" /> : s.icon}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide hidden sm:block ${isActive ? "text-primary" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-5 transition-colors ${isDone ? "bg-primary" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Selecionar Procedimento ──────────────────────────────────────────

function StepProcedimento({
  onSelect,
}: {
  onSelect: (procedure: PublicProcedure) => void;
}) {
  const [procedures, setProcedures] = useState<PublicProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedProc, setSelectedProc] = useState<PublicProcedure | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/procedures`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProcedures(data);
        } else {
          setError("Erro ao carregar procedimentos");
        }
      })
      .catch(() => setError("Não foi possível conectar ao servidor"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = procedures.reduce<Record<string, PublicProcedure[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-slate-500">Carregando procedimentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-red-600">
        <AlertCircle className="w-10 h-10" />
        <p>{error}</p>
      </div>
    );
  }

  if (procedures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
        <Dumbbell className="w-12 h-12 opacity-40" />
        <p className="text-lg font-medium">Nenhum procedimento disponível para agendamento online no momento</p>
        <p className="text-sm">Entre em contato direto com a clínica para agendar.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Escolha o Procedimento</h2>
      <p className="text-slate-500 text-sm mb-6">Selecione o serviço que deseja agendar</p>

      {Object.entries(grouped).map(([category, procs]) => (
        <div key={category} className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span>{CATEGORY_ICONS[category] ?? CATEGORY_ICONS["default"]}</span>
            {category}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {procs.map((proc) => (
              <button
                key={proc.id}
                onClick={() => { setSelected(proc.id); setSelectedProc(proc); }}
                className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md
                  ${selected === proc.id
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-slate-200 bg-white hover:border-primary/40"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-slate-800 text-sm leading-tight">{proc.name}</span>
                  {selected === proc.id && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" /> {proc.durationMinutes} min
                  </span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(proc.price)}</span>
                  {proc.maxCapacity > 1 && (
                    <Badge variant="secondary" className="text-[10px] h-4">
                      Grupo • até {proc.maxCapacity} pessoas
                    </Badge>
                  )}
                </div>
                {proc.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{proc.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 flex justify-end">
        <Button
          disabled={!selected || !selectedProc}
          onClick={() => selectedProc && onSelect(selectedProc)}
          className="rounded-xl h-11 px-8 gap-2"
        >
          Próximo <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Selecionar Data e Horário ─────────────────────────────────────────

function StepDataHora({
  procedure,
  onSelect,
  onBack,
}: {
  procedure: PublicProcedure;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}) {
  const today = startOfToday();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));

  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setLoadingSlots(true);
    setSlots([]);
    setSelectedTime(null);
    setError(null);

    fetch(`${BASE}/api/public/available-slots?date=${dateStr}&procedureId=${procedure.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.slots) {
          setSlots(data.slots);
        } else {
          setError("Não foi possível carregar os horários.");
        }
      })
      .catch(() => setError("Erro de conexão ao buscar horários."))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, procedure.id]);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Escolha a Data e Horário</h2>
      <p className="text-slate-500 text-sm mb-6">
        Procedimento: <strong className="text-primary">{procedure.name}</strong> — {procedure.durationMinutes} min
      </p>

      {/* Calendar strip */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Selecione a data</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const isSelected = selectedDate && format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            const dayName = format(day, "EEE", { locale: ptBR });
            const dayNum = format(day, "d");
            const monthName = format(day, "MMM", { locale: ptBR });
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center min-w-[60px] p-3 rounded-2xl border-2 transition-all shrink-0
                  ${isSelected
                    ? "border-primary bg-primary text-white shadow-md"
                    : "border-slate-200 bg-white hover:border-primary/40"}`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                  {dayName}
                </span>
                <span className={`text-xl font-bold leading-none mt-1 ${isSelected ? "text-white" : "text-slate-700"}`}>
                  {dayNum}
                </span>
                <span className={`text-[10px] mt-0.5 capitalize ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                  {monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Horários disponíveis — {formatDateBR(format(selectedDate, "yyyy-MM-dd"))}
          </p>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-slate-500 text-sm">Verificando horários...</span>
            </div>
          ) : error ? (
            <div className="text-center py-6 text-red-600 text-sm">{error}</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum horário disponível para esta data</p>
              <p className="text-xs mt-1">Tente outra data</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`py-2.5 px-2 rounded-xl text-sm font-semibold border-2 transition-all
                    ${!slot.available
                      ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      : selectedTime === slot.time
                      ? "border-primary bg-primary text-white shadow-md"
                      : "border-slate-200 bg-white hover:border-primary/50 text-slate-700"}`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          {procedure.maxCapacity > 1 && slots.some((s) => s.spotsLeft > 0 && s.spotsLeft < procedure.maxCapacity) && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Alguns horários têm vagas limitadas
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 gap-2">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button
          disabled={!selectedDate || !selectedTime}
          onClick={() => selectedDate && selectedTime && onSelect(format(selectedDate, "yyyy-MM-dd"), selectedTime)}
          className="rounded-xl h-11 px-8 gap-2"
        >
          Próximo <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Dados do Paciente ─────────────────────────────────────────────────

function StepDados({
  procedure,
  date,
  time,
  onSubmit,
  onBack,
  submitting,
}: {
  procedure: PublicProcedure;
  date: string;
  time: string;
  onSubmit: (data: { name: string; phone: string; email: string; cpf: string; notes: string }) => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf: "", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Seus Dados</h2>
      <p className="text-slate-500 text-sm mb-1">
        Preencha suas informações para confirmar o agendamento
      </p>

      {/* Summary card */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Dumbbell className="w-4 h-4 text-primary" />
          <span className="font-semibold text-slate-700">{procedure.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-slate-700">{formatDateBR(date)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-slate-700">às {time}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Nome completo *</Label>
            <Input
              required
              placeholder="Seu nome completo"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">CPF</Label>
            <Input
              placeholder="000.000.000-00 (opcional)"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Telefone / WhatsApp *</Label>
            <Input
              required
              placeholder="(11) 99999-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">E-mail</Label>
            <Input
              type="email"
              placeholder="seu@email.com (opcional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Observações</Label>
          <Textarea
            placeholder="Alguma informação adicional para a clínica? (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-xl resize-none"
            rows={3}
          />
        </div>

        <p className="text-xs text-slate-400">
          * campos obrigatórios. Seus dados são utilizados apenas para gestão do seu agendamento.
        </p>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl h-11 gap-2" disabled={submitting}>
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-xl h-11 px-8 gap-2">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Confirmar Agendamento</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Step 4: Confirmação ───────────────────────────────────────────────────────

function StepConfirmacao({
  confirmation,
  patientName,
  onNew,
}: {
  confirmation: BookingConfirmation;
  patientName: string;
  onNew: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const cancelUrl = `${window.location.origin}${BASE}/agendar/${confirmation.bookingToken}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(cancelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Agendamento Confirmado!</h2>
      <p className="text-slate-500 mb-8">
        Olá, <strong>{patientName}</strong>! Seu horário foi reservado com sucesso.
      </p>

      <Card className="border-none shadow-xl bg-white text-left mb-6">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{confirmation.appointment.procedure.name}</p>
              <p className="text-sm text-slate-500">{confirmation.appointment.procedure.durationMinutes} min</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-bold text-primary">{formatCurrency(confirmation.appointment.procedure.price)}</p>
              <Badge className="bg-green-100 text-green-700 border-0 text-xs">Agendado</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Data</p>
              <p className="font-semibold text-slate-800 text-sm capitalize">
                {formatDateBR(confirmation.appointment.date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Horário</p>
              <p className="font-semibold text-slate-800">
                {confirmation.appointment.startTime} – {confirmation.appointment.endTime}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link de gerenciamento */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
        <div className="flex items-start gap-3">
          <Link2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 mb-1">Guarde este link para cancelar</p>
            <p className="text-xs text-amber-700 mb-3">
              Através deste link você pode visualizar ou cancelar seu agendamento a qualquer momento.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-lg break-all flex-1">
                {cancelUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copyLink}
                className="shrink-0 h-7 rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={onNew} variant="outline" className="rounded-xl h-11 w-full">
        Fazer outro agendamento
      </Button>
    </div>
  );
}

// ── Booking Details View (via token) ─────────────────────────────────────────

function BookingView({ token }: { token: string }) {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/booking/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then(setBooking)
      .catch(() => setError("Agendamento não encontrado. Verifique o link."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCancel = async () => {
    if (!window.confirm("Deseja cancelar este agendamento?")) return;
    setCanceling(true);
    setCancelError(null);
    try {
      const r = await fetch(`${BASE}/api/public/booking/${token}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) {
        setCancelError(data.error ?? "Não foi possível cancelar.");
      } else {
        setCanceled(true);
        setBooking((b) => b ? { ...b, status: "cancelado" } : b);
      }
    } catch {
      setCancelError("Erro de conexão. Tente novamente.");
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-slate-500">Carregando agendamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-16 gap-4 text-red-600">
        <XCircle className="w-12 h-12" />
        <p className="text-lg font-medium">{error}</p>
        <a href={`${BASE}/agendar`} className="text-primary underline text-sm">
          Fazer um novo agendamento
        </a>
      </div>
    );
  }

  if (!booking) return null;

  const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, color: "text-slate-700 bg-slate-100" };
  const today = new Date().toISOString().split("T")[0];
  const canCancel = booking.status === "agendado" && booking.date >= today;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">Meu Agendamento</h2>

      {canceled && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-green-800 text-sm font-medium">Seu agendamento foi cancelado com sucesso.</p>
        </div>
      )}

      {cancelError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800 text-sm">{cancelError}</p>
        </div>
      )}

      <Card className="border-none shadow-xl bg-white">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-slate-400">#{booking.id}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Dumbbell className="w-4 h-4 text-primary" />
              <span className="font-semibold text-slate-800">{booking.procedure?.name ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-slate-700 capitalize">{formatDateBR(booking.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-slate-700">{booking.startTime} – {booking.endTime}</span>
            </div>
            {booking.patient && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{booking.patient.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{booking.patient.phone}</span>
                </div>
                {booking.patient.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{booking.patient.email}</span>
                  </div>
                )}
              </>
            )}
            {booking.notes && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="text-slate-600 italic">{booking.notes}</span>
              </div>
            )}
          </div>

          {canCancel && (
            <div className="pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={canceling}
                className="w-full h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                {canceling ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cancelando...</>
                ) : (
                  <><XCircle className="w-4 h-4 mr-2" /> Cancelar Agendamento</>
                )}
              </Button>
            </div>
          )}

          {!canCancel && booking.status === "agendado" && booking.date < today && (
            <p className="text-xs text-slate-400 text-center pt-2">
              Esta consulta já passou e não pode mais ser cancelada.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <a href={`${BASE}/agendar`} className="text-primary text-sm underline">
          Fazer um novo agendamento
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Agendar() {
  const [matchToken, paramsToken] = useRoute("/agendar/:token");
  const token = matchToken ? (paramsToken as any).token : null;

  const [step, setStep] = useState(1);
  const [procedure, setProcedure] = useState<PublicProcedure | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleProcedureSelect = (proc: PublicProcedure) => {
    setProcedure(proc);
    setStep(2);
  };

  const handleDateTimeSelect = (d: string, t: string) => {
    setDate(d);
    setTime(t);
    setStep(3);
  };

  const handleSubmit = async (data: { name: string; phone: string; email: string; cpf: string; notes: string }) => {
    if (!procedure || !date || !time) return;
    setSubmitting(true);
    setSubmitError(null);
    setPatientName(data.name);

    try {
      const r = await fetch(`${BASE}/api/public/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureId: procedure.id,
          date,
          startTime: time,
          patientName: data.name,
          patientPhone: data.phone,
          patientEmail: data.email || undefined,
          patientCpf: data.cpf || undefined,
          notes: data.notes || undefined,
        }),
      });

      const result = await r.json();

      if (!r.ok) {
        setSubmitError(result.message ?? result.error ?? "Erro ao confirmar agendamento.");
      } else {
        setConfirmation(result);
        setStep(4);
      }
    } catch {
      setSubmitError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => {
    setProcedure(null);
    setDate(null);
    setTime(null);
    setConfirmation(null);
    setSubmitError(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9">
              <LogoMark />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">FisioGest Pro</p>
              <p className="text-[10px] text-slate-400 leading-tight">Agendamento Online</p>
            </div>
          </div>
          {!token && (
            <a
              href={`${BASE}/login`}
              className="text-xs text-primary underline hidden sm:inline"
            >
              Acesso para profissionais
            </a>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {token ? (
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <BookingView token={token} />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              {step < 4 && <StepIndicator step={step} total={4} />}

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-red-800 text-sm font-medium">Não foi possível confirmar o agendamento</p>
                    <p className="text-red-700 text-xs mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <StepProcedimento onSelect={handleProcedureSelect} />
              )}
              {step === 2 && procedure && (
                <StepDataHora
                  procedure={procedure}
                  onSelect={handleDateTimeSelect}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && procedure && date && time && (
                <StepDados
                  procedure={procedure}
                  date={date}
                  time={time}
                  onSubmit={handleSubmit}
                  onBack={() => setStep(2)}
                  submitting={submitting}
                />
              )}
              {step === 4 && confirmation && (
                <StepConfirmacao
                  confirmation={confirmation}
                  patientName={patientName}
                  onNew={handleNew}
                />
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400">
        <p>© {new Date().getFullYear()} FisioGest Pro — Gestão Clínica</p>
      </footer>
    </div>
  );
}
