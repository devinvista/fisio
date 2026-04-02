import { useState, useEffect, useRef, useCallback } from "react";
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
  Star,
  Sparkles,
  UserCheck,
  UserPlus,
  ClipboardList,
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

interface PatientLookupResult {
  found: boolean;
  patient?: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    cpf: string;
  };
  activeTreatmentPlan?: {
    id: number;
    objectives: string | null;
    techniques: string | null;
    frequency: string | null;
    estimatedSessions: number | null;
    status: string;
  } | null;
  recommendedProcedureIds?: number[];
}

async function lookupPatient(q: string): Promise<PatientLookupResult> {
  if (q.trim().length < 4) return { found: false };
  const res = await fetch(`${BASE}/api/public/patient-lookup?q=${encodeURIComponent(q.trim())}`);
  if (!res.ok) return { found: false };
  return res.json();
}

const CATEGORY_ICONS: Record<string, string> = {
  "Reabilitação": "🦴",
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
    { label: "Seus Dados", icon: <FileText className="w-4 h-4" /> },
    { label: "Procedimento", icon: <Dumbbell className="w-4 h-4" /> },
    { label: "Data e Hora", icon: <Calendar className="w-4 h-4" /> },
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

// ── Step 1: Seus Dados (identificação + dados do paciente) ────────────────────

interface PatientFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  notes: string;
}

function StepSeusDados({
  onNext,
  initialForm,
}: {
  onNext: (data: PatientFormData, patient: PatientLookupResult | null) => void;
  initialForm?: Partial<PatientFormData>;
}) {
  const [form, setForm] = useState<PatientFormData>({
    name: initialForm?.name ?? "",
    phone: initialForm?.phone ?? "",
    email: initialForm?.email ?? "",
    cpf: initialForm?.cpf ?? "",
    notes: initialForm?.notes ?? "",
  });

  const [lookupState, setLookupState] = useState<"idle" | "searching" | "found" | "new">("idle");
  const [foundPatient, setFoundPatient] = useState<PatientLookupResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runLookup = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const cleaned = q.replace(/\D/g, "");
    if (cleaned.length < 8 && q.trim().length < 8) {
      setLookupState("idle");
      setFoundPatient(null);
      return;
    }
    setLookupState("searching");
    debounceRef.current = setTimeout(async () => {
      const r = await lookupPatient(q);
      if (r.found && r.patient) {
        setFoundPatient(r);
        setLookupState("found");
        setForm((prev) => ({
          ...prev,
          name: r.patient!.name,
          phone: r.patient!.phone ?? prev.phone,
          email: r.patient!.email ?? prev.email,
          cpf: r.patient!.cpf ?? prev.cpf,
        }));
      } else {
        setFoundPatient(null);
        setLookupState("new");
      }
    }, 600);
  }, []);

  // CPF is the primary lookup field — triggers search only when all 11 digits are present
  const handleCpfChange = (val: string) => {
    setForm((prev) => ({ ...prev, cpf: val }));
    const digits = val.replace(/\D/g, "");
    if (digits.length === 11) {
      runLookup(val);
    } else if (digits.length < 8) {
      // Reset lookup state when user clears the CPF field
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setLookupState("idle");
      setFoundPatient(null);
    }
  };

  // Phone is secondary — only triggers lookup if CPF hasn't already found the patient
  const handlePhoneChange = (val: string) => {
    setForm((prev) => ({ ...prev, phone: val }));
    if (lookupState !== "found") {
      runLookup(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(form, foundPatient);
  };

  const isPreFilled = lookupState === "found" && !!foundPatient?.patient;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Seus Dados</h2>
        <p className="text-slate-500 text-sm">
          Digite seu CPF para buscar seu cadastro automaticamente. Se for seu primeiro agendamento, preencha os demais campos.
        </p>
      </div>

      {/* Lookup status banners */}
      {isPreFilled && foundPatient?.patient && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-emerald-800">
                Bem-vindo de volta, {foundPatient.patient.name.split(" ")[0]}!
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                Cadastro encontrado — dados preenchidos automaticamente.
              </p>
              {foundPatient.activeTreatmentPlan && (
                <div className="mt-3 bg-white border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" /> Plano de tratamento ativo
                  </p>
                  {foundPatient.activeTreatmentPlan.frequency && (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Frequência:</span> {foundPatient.activeTreatmentPlan.frequency}
                    </p>
                  )}
                  {foundPatient.activeTreatmentPlan.objectives && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {foundPatient.activeTreatmentPlan.objectives}
                    </p>
                  )}
                </div>
              )}
              {!foundPatient.activeTreatmentPlan && (foundPatient.recommendedProcedureIds?.length ?? 0) > 0 && (
                <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Seus procedimentos mais usados serão destacados na próxima etapa.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {lookupState === "new" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-blue-800">Primeiro agendamento?</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Não encontramos um cadastro com esses dados. Preencha as informações abaixo — faremos seu cadastro automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* CPF — campo principal de identificação, sempre dispara lookup */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">CPF *</Label>
            <div className="relative">
              <Input
                autoFocus
                required
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                className={`h-11 rounded-xl pr-10 transition-all
                  ${isPreFilled ? "border-emerald-300 bg-emerald-50/30" : ""}
                  ${lookupState === "new" ? "border-blue-300" : ""}`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {lookupState === "searching" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {lookupState === "found" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {lookupState === "new" && <UserPlus className="w-4 h-4 text-blue-400" />}
              </div>
            </div>
          </div>

          {/* Telefone — campo secundário de identificação */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Telefone / WhatsApp *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                required
                placeholder="(11) 99999-0000"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={`h-11 rounded-xl pl-9 transition-all
                  ${isPreFilled ? "border-emerald-300 bg-emerald-50/30" : ""}
                  ${lookupState === "new" ? "border-blue-300" : ""}`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Nome completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                required
                placeholder="Seu nome completo"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className={`h-11 rounded-xl pl-9 ${isPreFilled ? "border-emerald-300 bg-emerald-50/30" : ""}`}
              />
            </div>
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="email"
                placeholder="seu@email.com (opcional)"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className={`h-11 rounded-xl pl-9 ${isPreFilled && form.email ? "border-emerald-300 bg-emerald-50/30" : ""}`}
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" /> Observações
          </Label>
          <Textarea
            placeholder="Alguma informação adicional para a clínica? (opcional)"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="rounded-xl resize-none"
            rows={3}
          />
        </div>

        <p className="text-xs text-slate-400">
          * campos obrigatórios. Seus dados são utilizados apenas para gestão do seu agendamento.
        </p>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className="rounded-xl h-11 px-8 gap-2"
            disabled={lookupState === "searching"}
          >
            {isPreFilled ? (
              <><UserCheck className="w-4 h-4" /> Continuar como {foundPatient?.patient?.name.split(" ")[0]}</>
            ) : (
              <>Próximo <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Step 2: Selecionar Procedimento ──────────────────────────────────────────

function ProcedureCard({
  proc,
  selected,
  recommended,
  onSelect,
}: {
  proc: PublicProcedure;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md relative
        ${selected
          ? "border-primary bg-primary/5 shadow-md"
          : recommended
          ? "border-amber-300 bg-amber-50/60 hover:border-amber-400"
          : "border-slate-200 bg-white hover:border-primary/40"}`}
    >
      {recommended && !selected && (
        <span className="absolute -top-2 left-3 inline-flex items-center gap-1 text-[9px] font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          <Star className="w-2.5 h-2.5" /> Recomendado
        </span>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-slate-800 text-sm leading-tight">{proc.name}</span>
        {selected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
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
  );
}

function StepProcedimento({
  onSelect,
  foundPatient,
  onBack,
}: {
  onSelect: (procedure: PublicProcedure) => void;
  foundPatient: PatientLookupResult | null;
  onBack?: () => void;
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

  const recommendedIds = foundPatient?.recommendedProcedureIds ?? [];
  const hasPlan = !!foundPatient?.activeTreatmentPlan;

  // Sort: recommended first, then by category/name
  const sortedProcedures = [...procedures].sort((a, b) => {
    const aRank = recommendedIds.indexOf(a.id);
    const bRank = recommendedIds.indexOf(b.id);
    if (aRank !== -1 && bRank === -1) return -1;
    if (bRank !== -1 && aRank === -1) return 1;
    if (aRank !== -1 && bRank !== -1) return aRank - bRank;
    return 0;
  });

  const grouped = sortedProcedures.reduce<Record<string, PublicProcedure[]>>((acc, p) => {
    const key = recommendedIds.includes(p.id) ? "__recomendados__" : p.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // Build ordered category list: recommended first, then the rest
  const categoryOrder = [
    ...(grouped["__recomendados__"] ? ["__recomendados__"] : []),
    ...Object.keys(grouped).filter((k) => k !== "__recomendados__"),
  ];

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
      <p className="text-slate-500 text-sm mb-4">Selecione o serviço que deseja agendar</p>

      {/* Patient welcome banner */}
      {foundPatient?.found && foundPatient.patient && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-5 flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Bem-vindo de volta, {foundPatient.patient.name.split(" ")[0]}!
            </p>
            {hasPlan ? (
              <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                Você tem um plano de tratamento ativo — procedimentos recomendados estão destacados abaixo.
              </p>
            ) : (
              <p className="text-xs text-emerald-700 mt-0.5">
                {recommendedIds.length > 0
                  ? "Seus procedimentos mais usados estão destacados abaixo."
                  : "Seus dados serão preenchidos automaticamente na próxima etapa."}
              </p>
            )}
          </div>
        </div>
      )}

      {categoryOrder.map((category) => {
        const procs = grouped[category];
        const isRecommended = category === "__recomendados__";
        return (
          <div key={category} className="mb-6">
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5 ${isRecommended ? "text-amber-600" : "text-slate-400"}`}>
              {isRecommended ? (
                <><Sparkles className="w-3.5 h-3.5" /> {hasPlan ? "Do seu plano de tratamento" : "Usados recentemente"}</>
              ) : (
                <><span>{CATEGORY_ICONS[category] ?? CATEGORY_ICONS["default"]}</span>{category}</>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {procs.map((proc) => (
                <ProcedureCard
                  key={proc.id}
                  proc={proc}
                  selected={selected === proc.id}
                  recommended={isRecommended}
                  onSelect={() => { setSelected(proc.id); setSelectedProc(proc); }}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-6 flex justify-between">
        {onBack ? (
          <Button variant="outline" onClick={onBack} className="rounded-xl h-11 gap-2">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        ) : <div />}
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
  submitting,
}: {
  procedure: PublicProcedure;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
  submitting?: boolean;
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
        <Button variant="outline" onClick={onBack} disabled={submitting} className="rounded-xl h-11 gap-2">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button
          disabled={!selectedDate || !selectedTime || submitting}
          onClick={() => selectedDate && selectedTime && onSelect(format(selectedDate, "yyyy-MM-dd"), selectedTime)}
          className="rounded-xl h-11 px-8 gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Confirmar Agendamento</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Confirmação ───────────────────────────────────────────────────────

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

  const [clinicInfo, setClinicInfo] = useState<{ name: string; logoUrl?: string | null } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/clinic-info`)
      .then((r) => r.json())
      .then((data) => setClinicInfo(data))
      .catch(() => {});
  }, []);

  const clinicName = clinicInfo?.name || "FisioGest Pro";

  // Wizard state — 3 steps: Seus Dados → Procedimento → Data e Hora → Confirmação
  const [step, setStep] = useState(1);
  const [patientFormData, setPatientFormData] = useState<PatientFormData | null>(null);
  const [foundPatient, setFoundPatient] = useState<PatientLookupResult | null>(null);
  const [procedure, setProcedure] = useState<PublicProcedure | null>(null);
  const [patientName, setPatientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1: Seus Dados — collect patient info + auto-lookup
  const handlePatientNext = (data: PatientFormData, patient: PatientLookupResult | null) => {
    setPatientFormData(data);
    setFoundPatient(patient);
    setStep(2);
  };

  // Step 2: Procedimento — choose procedure filtered by active plan
  const handleProcedureSelect = (proc: PublicProcedure) => {
    setProcedure(proc);
    setStep(3);
  };

  // Step 3: Data e Hora — select date/time and submit booking
  const handleDateTimeSelect = async (d: string, t: string) => {
    if (!procedure || !patientFormData) return;
    setSubmitting(true);
    setSubmitError(null);
    setPatientName(patientFormData.name);

    try {
      const r = await fetch(`${BASE}/api/public/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureId: procedure.id,
          date: d,
          startTime: t,
          patientName: patientFormData.name,
          patientPhone: patientFormData.phone,
          patientEmail: patientFormData.email || undefined,
          patientCpf: patientFormData.cpf || undefined,
          notes: patientFormData.notes || undefined,
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
    setPatientFormData(null);
    setFoundPatient(null);
    setProcedure(null);
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
            {clinicInfo?.logoUrl ? (
              <img src={clinicInfo.logoUrl} alt={clinicName} className="h-9 w-auto max-w-[120px] object-contain" />
            ) : (
              <div className="w-9 h-9"><LogoMark /></div>
            )}
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{clinicName}</p>
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
              {step < 4 && <StepIndicator step={step} total={3} />}

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-red-800 text-sm font-medium">Não foi possível confirmar o agendamento</p>
                    <p className="text-red-700 text-xs mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Step 1: Seus Dados */}
              {step === 1 && (
                <StepSeusDados
                  onNext={handlePatientNext}
                  initialForm={patientFormData ?? undefined}
                />
              )}

              {/* Step 2: Procedimento */}
              {step === 2 && (
                <StepProcedimento
                  onSelect={handleProcedureSelect}
                  foundPatient={foundPatient}
                  onBack={() => setStep(1)}
                />
              )}

              {/* Step 3: Data e Hora (submits on confirm) */}
              {step === 3 && procedure && (
                <StepDataHora
                  procedure={procedure}
                  onSelect={handleDateTimeSelect}
                  onBack={() => setStep(2)}
                  submitting={submitting}
                />
              )}

              {/* Confirmação */}
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
        <p>© {new Date().getFullYear()} {clinicName} — Gestão Clínica</p>
      </footer>
    </div>
  );
}
