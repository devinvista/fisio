import { useState, useEffect, useCallback } from "react";
import { maskCpf, maskPhone, maskCnpj, displayCpf } from "@/lib/masks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Save,
  Phone,
  Mail,
  MapPin,
  Hash,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
  Clock,
  Calendar,
  User2,
  Power,
  PowerOff,
  Settings2,
  ChevronRight,
  Globe,
  Upload,
  ImageIcon,
  Award,
  UserCheck,
  X,
  ShieldAlert,
  Timer,
  BadgeDollarSign,
  CheckCircle2,
} from "lucide-react";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE.replace(/\/$/, "").replace(/\/[^/]+$/, "");

type Section = "clinica" | "usuarios" | "agendas";

function getHashSection(): Section {
  const h = window.location.hash.replace("#", "");
  if (h === "usuarios" || h === "agendas" || h === "clinica") return h;
  return "clinica";
}

/* ─── Types ─────────────────────────────────────────────────── */

interface Clinic {
  id: number;
  name: string;
  type?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  crefito?: string | null;
  responsibleTechnical?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  cancellationPolicyHours?: number | null;
  autoConfirmHours?: number | null;
  noShowFeeEnabled?: boolean;
  noShowFeeAmount?: string | null;
}

interface SystemUser {
  id: number;
  name: string;
  cpf: string;
  email?: string | null;
  roles: string[];
  createdAt: string;
}

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

/* ─── Constants ─────────────────────────────────────────────── */

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  profissional: "bg-blue-100 text-blue-800 border-blue-200",
  secretaria: "bg-green-100 text-green-800 border-green-200",
};

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

interface ScheduleFormState {
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

const DEFAULT_SCHEDULE_FORM: ScheduleFormState = {
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

const EMPTY_USER_FORM = {
  name: "",
  cpf: "",
  email: "",
  password: "",
  roles: ["profissional"] as Role[],
};

/* ─── Helpers ───────────────────────────────────────────────── */

function parseDays(workingDays: string): string[] {
  if (!workingDays) return [];
  return workingDays
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

function formatDaysBadges(workingDays: string) {
  const days = parseDays(workingDays);
  return DAYS_OF_WEEK.filter((d) => days.includes(d.value));
}

/* ─── API functions ─────────────────────────────────────────── */

async function fetchCurrentClinic(): Promise<Clinic> {
  const res = await fetch(`${API_BASE}/api/clinics/current`);
  if (!res.ok) throw new Error("Falha ao carregar dados da clínica");
  return res.json();
}

async function updateCurrentClinic(data: Partial<Clinic>): Promise<Clinic> {
  const res = await fetch(`${API_BASE}/api/clinics/current`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || "Erro ao atualizar clínica");
  }
  return res.json();
}

async function fetchUsers(): Promise<SystemUser[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Falha ao carregar usuários");
  return res.json();
}

/* ─── Section: Minha Clínica ────────────────────────────────── */

function ClinicaSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    type: "clinica",
    cnpj: "",
    cpf: "",
    crefito: "",
    responsibleTechnical: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    logoUrl: "",
    cancellationPolicyHours: "" as string | number,
    autoConfirmHours: "" as string | number,
    noShowFeeEnabled: false,
    noShowFeeAmount: "",
  });
  const [logoPreview, setLogoPreview] = useState<string>("");

  const { data: clinic, isLoading } = useQuery<Clinic>({
    queryKey: ["clinic-current"],
    queryFn: fetchCurrentClinic,
  });

  useEffect(() => {
    if (clinic) {
      setFormData({
        name: clinic.name ?? "",
        type: clinic.type ?? "clinica",
        cnpj: clinic.cnpj ? maskCnpj(clinic.cnpj) : "",
        cpf: clinic.cpf ? maskCpf(clinic.cpf) : "",
        crefito: clinic.crefito ?? "",
        responsibleTechnical: clinic.responsibleTechnical ?? "",
        phone: clinic.phone ?? "",
        email: clinic.email ?? "",
        address: clinic.address ?? "",
        website: clinic.website ?? "",
        logoUrl: clinic.logoUrl ?? "",
        cancellationPolicyHours: clinic.cancellationPolicyHours ?? "",
        autoConfirmHours: clinic.autoConfirmHours ?? "",
        noShowFeeEnabled: clinic.noShowFeeEnabled ?? false,
        noShowFeeAmount: clinic.noShowFeeAmount ?? "",
      });
      setLogoPreview(clinic.logoUrl ?? "");
    }
  }, [clinic]);

  const updateMutation = useMutation({
    mutationFn: updateCurrentClinic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-current"] });
      queryClient.invalidateQueries({ queryKey: ["all-clinics-switcher"] });
      toast({ title: "Dados da clínica atualizados com sucesso!" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Logo muito grande", description: "Selecione uma imagem de até 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setFormData((p) => ({ ...p, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Clinic> = {
      ...formData,
      cancellationPolicyHours: formData.cancellationPolicyHours !== "" ? Number(formData.cancellationPolicyHours) : null,
      autoConfirmHours: formData.autoConfirmHours !== "" ? Number(formData.autoConfirmHours) : null,
    };
    updateMutation.mutate(payload);
  };

  const isAutonomo = formData.type === "autonomo";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* ── Tipo de Estabelecimento ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Tipo de Estabelecimento
          </CardTitle>
          <CardDescription>Define o modelo jurídico e os campos de identificação exibidos nos documentos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData((p) => ({ ...p, type: "autonomo" }))}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isAutonomo
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 hover:border-slate-300 text-slate-600"
              }`}
            >
              <User2 className="h-6 w-6" />
              <div className="text-center">
                <p className="text-sm font-semibold">Profissional Autônomo</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">CPF · CREFITO / CREF individual</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData((p) => ({ ...p, type: "clinica" }))}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                !isAutonomo
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 hover:border-slate-300 text-slate-600"
              }`}
            >
              <Building2 className="h-6 w-6" />
              <div className="text-center">
                <p className="text-sm font-semibold">Clínica / Empresa</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">CNPJ · Responsável Técnico (RT)</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Identidade & Logotipo ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Identidade Visual
          </CardTitle>
          <CardDescription>Nome e logotipo aparecem no cabeçalho de todos os documentos gerados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic-name">
              {isAutonomo ? "Nome do Profissional / Consultório *" : "Nome da Clínica *"}
            </Label>
            <Input
              id="clinic-name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder={isAutonomo ? "Ex: Dr. João Silva — Fisioterapia" : "Ex: Clínica FisioGest"}
              required
            />
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Logotipo
            </Label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <div className="inline-flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Escolher imagem
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => { setLogoPreview(""); setFormData((p) => ({ ...p, logoUrl: "" })); }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                  >
                    <X className="h-3 w-3" /> Remover logo
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground">PNG, JPG ou SVG · máx. 2 MB · recomendado 300×100 px</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Identificação Legal ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4" />
            {isAutonomo ? "Identificação do Profissional" : "Identificação da Empresa"}
          </CardTitle>
          <CardDescription>
            {isAutonomo
              ? "CPF e registro profissional usados nos documentos clínicos."
              : "CNPJ e dados do Responsável Técnico (RT) para emissão de documentos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAutonomo ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-cpf" className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> CPF do Profissional
                </Label>
                <Input
                  id="clinic-cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData((p) => ({ ...p, cpf: maskCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-crefito" className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" /> CREFITO / CREF
                </Label>
                <Input
                  id="clinic-crefito"
                  value={formData.crefito}
                  onChange={(e) => setFormData((p) => ({ ...p, crefito: e.target.value }))}
                  placeholder="Ex: CREFITO-3/12345-F"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-cnpj" className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> CNPJ
                </Label>
                <Input
                  id="clinic-cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData((p) => ({ ...p, cnpj: maskCnpj(e.target.value) }))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-rt" className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Responsável Técnico (RT)
                  </Label>
                  <Input
                    id="clinic-rt"
                    value={formData.responsibleTechnical}
                    onChange={(e) => setFormData((p) => ({ ...p, responsibleTechnical: e.target.value }))}
                    placeholder="Nome completo do RT"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-crefito" className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" /> CREFITO / CREF do RT
                  </Label>
                  <Input
                    id="clinic-crefito"
                    value={formData.crefito}
                    onChange={(e) => setFormData((p) => ({ ...p, crefito: e.target.value }))}
                    placeholder="Ex: CREFITO-3/12345-F"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Contato ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contato e Endereço</CardTitle>
          <CardDescription>Aparecem no rodapé e cabeçalho dos documentos emitidos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              <Input
                id="clinic-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </Label>
              <Input
                id="clinic-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="contato@clinica.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-address" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Endereço Completo
            </Label>
            <Input
              id="clinic-address"
              value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              placeholder="Rua, número, bairro, cidade - Estado, CEP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-website" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Site / Redes Sociais
            </Label>
            <Input
              id="clinic-website"
              value={formData.website}
              onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
              placeholder="www.clinica.com.br"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Políticas de Agendamento ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Políticas de Agendamento
          </CardTitle>
          <CardDescription>
            Regras automáticas de confirmação, cancelamento e taxa de ausência. Aplicadas pelo sistema a cada hora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Cancelamento / Reagendamento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  Antecedência mínima para cancelamento
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Número de horas de aviso prévio exigidas para cancelar ou reagendar sem penalidade.
                  Deixe em branco para desativar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="168"
                value={formData.cancellationPolicyHours}
                onChange={(e) => setFormData((p) => ({ ...p, cancellationPolicyHours: e.target.value }))}
                placeholder="Ex: 24"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">horas de antecedência</span>
            </div>
            {formData.cancellationPolicyHours && Number(formData.cancellationPolicyHours) > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Pacientes devem cancelar/reagendar com pelo menos <strong className="mx-1">{formData.cancellationPolicyHours}h</strong> de antecedência.
                Essa cláusula aparecerá automaticamente nos contratos gerados.
              </div>
            )}
          </div>

          <Separator />

          {/* Confirmação Automática */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Confirmação automática
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agendamentos pendentes serão confirmados automaticamente quando faltarem menos de X horas.
                  Deixe em branco para desativar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="72"
                value={formData.autoConfirmHours}
                onChange={(e) => setFormData((p) => ({ ...p, autoConfirmHours: e.target.value }))}
                placeholder="Ex: 2"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">horas antes do atendimento</span>
            </div>
            {formData.autoConfirmHours && Number(formData.autoConfirmHours) > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Agendamentos serão confirmados automaticamente <strong className="mx-1">{formData.autoConfirmHours}h</strong> antes do horário marcado.
              </div>
            )}
          </div>

          <Separator />

          {/* Taxa de Não Comparecimento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  Taxa de não comparecimento (no-show)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Valor cobrado automaticamente quando um agendamento é marcado como "Faltou" sem justificativa.
                </p>
              </div>
              <Switch
                checked={formData.noShowFeeEnabled}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, noShowFeeEnabled: v }))}
              />
            </div>
            {formData.noShowFeeEnabled && (
              <div className="flex items-center gap-3 pl-1">
                <span className="text-sm font-medium text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.noShowFeeAmount}
                  onChange={(e) => setFormData((p) => ({ ...p, noShowFeeAmount: e.target.value }))}
                  placeholder="0,00"
                  className="w-36"
                />
                <span className="text-sm text-muted-foreground">por falta não justificada</span>
              </div>
            )}
            {formData.noShowFeeEnabled && formData.noShowFeeAmount && Number(formData.noShowFeeAmount) > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                <BadgeDollarSign className="h-3.5 w-3.5 shrink-0" />
                Uma cobrança de <strong className="mx-1">R$ {Number(formData.noShowFeeAmount).toFixed(2).replace(".", ",")}</strong>
                será gerada automaticamente para cada falta não justificada.
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="gap-2 min-w-36"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/* ─── Section: Usuários ─────────────────────────────────────── */

function UsuariosSection() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState(EMPTY_USER_FORM);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_USER_FORM) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao criar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Usuário criado com sucesso" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        name: string;
        cpf?: string;
        email?: string;
        roles: Role[];
        password?: string;
      };
    }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao atualizar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Usuário atualizado com sucesso" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao excluir usuário");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Usuário excluído" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
    setDialogOpen(true);
  }

  function openEdit(u: SystemUser) {
    setEditingUser(u);
    setForm({
      name: u.name,
      cpf: maskCpf(u.cpf),
      email: u.email ?? "",
      password: "",
      roles: u.roles as Role[],
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
  }

  function toggleRole(role: Role) {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const next = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      return { ...prev, roles: next.length === 0 ? [role] : next };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.roles.length === 0) {
      toast({ title: "Selecione pelo menos um perfil", variant: "destructive" });
      return;
    }
    if (!form.cpf) {
      toast({ title: "CPF é obrigatório", variant: "destructive" });
      return;
    }
    if (editingUser) {
      const data: {
        name: string;
        cpf: string;
        email?: string;
        roles: Role[];
        password?: string;
      } = {
        name: form.name,
        cpf: form.cpf,
        email: form.email || undefined,
        roles: form.roles,
      };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.password) {
        toast({ title: "Senha é obrigatória", variant: "destructive" });
        return;
      }
      createMutation.mutate({
        name: form.name,
        cpf: form.cpf,
        email: form.email || undefined,
        password: form.password,
        roles: form.roles,
      } as any);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Gestão de Usuários</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários e perfis de acesso do sistema
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">CPF</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead>Perfis</TableHead>
              <TableHead className="hidden lg:table-cell">Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-muted-foreground">(você)</span>
                        )}
                        <p className="text-xs text-muted-foreground md:hidden truncate">{u.email ?? ""}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm hidden md:table-cell">
                    {displayCpf(u.cpf)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {u.email ?? <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            ROLE_COLORS[r as Role] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ROLE_LABELS[r as Role] ?? r}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={u.id === currentUser?.id || deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize os dados e perfis do usuário."
                : "Preencha os dados para criar um novo usuário no sistema."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome completo</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Dra. Ana Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-cpf">CPF *</Label>
              <Input
                id="user-cpf"
                type="text"
                inputMode="numeric"
                value={form.cpf}
                onChange={(e) => setForm((p) => ({ ...p, cpf: maskCpf(e.target.value) }))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">
                E-mail{" "}
                <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="usuario@clinica.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">
                {editingUser ? "Nova senha (deixe em branco para manter)" : "Senha"}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder={editingUser ? "••••••" : "Mínimo 6 caracteres"}
                minLength={editingUser ? 0 : 6}
                required={!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label>Perfis de acesso</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {ROLES.map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <Checkbox
                      id={`role-${role}`}
                      checked={form.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label
                      htmlFor={`role-${role}`}
                      className="flex flex-col cursor-pointer select-none"
                    >
                      <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                      <span className="text-xs text-muted-foreground">
                        {role === "admin" && "Acesso completo a todas as funcionalidades"}
                        {role === "profissional" && "Pacientes, prontuário, agenda e relatórios"}
                        {role === "secretaria" && "Agenda e consulta de pacientes"}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={closeDialog}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? "Salvar alterações" : "Criar usuário"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Section: Agendas ──────────────────────────────────────── */

function AgendasSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(DEFAULT_SCHEDULE_FORM);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => fetch("/api/schedules").then((r) => r.json()),
  });

  const { data: users = [] } = useQuery<SystemUser[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const professionals = users.filter(
    (u: any) =>
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
    onError: (err: any) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok)
          throw new Error((await r.json()).message ?? "Erro ao atualizar agenda");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setDialogOpen(false);
      toast({ title: "Agenda atualizada com sucesso!" });
    },
    onError: (err: any) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setDeleteTarget(null);
      toast({ title: "Agenda removida." });
    },
    onError: () =>
      toast({ title: "Erro ao remover agenda", variant: "destructive" }),
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
    setForm(DEFAULT_SCHEDULE_FORM);
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
      toast({
        title: "Selecione ao menos um dia de funcionamento",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      professionalId:
        form.type === "professional" && form.professionalId
          ? parseInt(form.professionalId)
          : null,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Agendas da Clínica</h3>
          <p className="text-sm text-muted-foreground">
            Configure agendas gerais ou vinculadas a profissionais.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Agenda
        </Button>
      </div>

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
              onToggle={() =>
                toggleMutation.mutate({ id: schedule.id, isActive: !schedule.isActive })
              }
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Agenda" : "Nova Agenda"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Atualize as configurações desta agenda."
                : "Configure uma nova agenda para a sua clínica."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Nome da agenda *</Label>
              <Input
                placeholder="Ex: Agenda Geral, Fisioterapia, Dr. Silva..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição opcional..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de agenda</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v, professionalId: "" }))
                }
              >
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

            {form.type === "professional" && (
              <div className="space-y-1.5">
                <Label>Profissional</Label>
                <Select
                  value={form.professionalId}
                  onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v }))}
                >
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
                        ${
                          active
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

            <div className="space-y-1.5">
              <Label>Duração do slot (minutos)</Label>
              <Select
                value={form.slotDurationMinutes}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, slotDurationMinutes: v }))
                }
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

            <div className="space-y-2">
              <Label>Cor da agenda</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
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
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agenda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a agenda{" "}
              <strong>{deleteTarget?.name}</strong>? Os agendamentos existentes não
              serão excluídos.
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
    </div>
  );
}

/* ─── Schedule Card ─────────────────────────────────────────── */

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
      <div className="h-1.5 w-full" style={{ backgroundColor: schedule.color }} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {schedule.name}
            </h3>
            {schedule.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {schedule.description}
              </p>
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

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {schedule.startTime} – {schedule.endTime}
          </span>
          <span className="text-border">·</span>
          <span>{schedule.slotDurationMinutes} min/slot</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {days.length === 7 ? (
              <span className="font-medium text-foreground">Todos os dias</span>
            ) : days.length === 0 ? (
              <span className="text-destructive">Nenhum dia selecionado</span>
            ) : (
              days.map((d) => (
                <span key={d.value} className="font-medium text-foreground">
                  {d.label}
                </span>
              ))
            )}
          </div>
        </div>

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

/* ─── Settings nav config ───────────────────────────────────── */

interface SectionConfig {
  id: Section;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: "settings.manage" | "users.manage";
}

const SECTIONS: SectionConfig[] = [
  {
    id: "clinica",
    label: "Minha Clínica",
    description: "Dados e informações da clínica",
    icon: Building2,
    permission: "settings.manage",
  },
  {
    id: "usuarios",
    label: "Usuários",
    description: "Gestão de usuários e perfis",
    icon: UserCog,
    permission: "users.manage",
  },
  {
    id: "agendas",
    label: "Agendas",
    description: "Configurações de horários e agendas",
    icon: CalendarDays,
    permission: "settings.manage",
  },
];

/* ─── Main Page ─────────────────────────────────────────────── */

export default function Configuracoes() {
  const { hasPermission } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>(getHashSection);

  const visibleSections = SECTIONS.filter((s) => hasPermission(s.permission));

  const currentSection = visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0];

  const navigate = useCallback(
    (section: Section) => {
      setActiveSection(section);
      window.history.replaceState(null, "", `${window.location.pathname}#${section}`);
    },
    []
  );

  useEffect(() => {
    if (currentSection && currentSection.id !== activeSection) {
      setActiveSection(currentSection.id);
    }
  }, [currentSection, activeSection]);

  useEffect(() => {
    const onHashChange = () => setActiveSection(getHashSection());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (visibleSections.length === 0) {
    return (
      <AppLayout title="Configurações">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar as configurações.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* ── Navigation — horizontal tabs on mobile, sidebar on md+ ── */}
        <aside className="md:w-56 md:shrink-0">
          {/* Mobile: scrollable pill tabs */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 md:sticky md:top-0 scrollbar-none">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const isActive = currentSection?.id === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => navigate(section.id)}
                  className={`
                    shrink-0 flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-left transition-all
                    md:w-full
                    ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }
                  `}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm leading-tight whitespace-nowrap md:whitespace-normal md:truncate">{section.label}</div>
                    <div
                      className={`text-xs leading-tight truncate mt-0.5 hidden md:block ${
                        isActive ? "text-primary/70" : "text-muted-foreground/70"
                      }`}
                    >
                      {section.description}
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary hidden md:block" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Divider — vertical on desktop, horizontal on mobile ── */}
        <div className="hidden md:block w-px bg-border shrink-0" />
        <div className="md:hidden h-px bg-border" />

        {/* ── Content area ── */}
        <div className="flex-1 min-w-0">
          {/* Section header */}
          {currentSection && (
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <currentSection.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">{currentSection.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground pl-0.5">
                {currentSection.description}
              </p>
              <Separator className="mt-4" />
            </div>
          )}

          {/* Section content */}
          <div className="mt-6">
            {currentSection?.id === "clinica" && <ClinicaSection />}
            {currentSection?.id === "usuarios" && <UsuariosSection />}
            {currentSection?.id === "agendas" && <AgendasSection />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
