import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useListPatients, useCreatePatient } from "@workspace/api-client-react";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  UserPlus,
  Phone,
  Mail,
  ChevronRight,
  Loader2,
  LayoutGrid,
  LayoutList,
  Users,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskCpf, maskPhone, displayCpf } from "@/lib/masks";
import { DatePickerPTBR } from "@/components/ui/date-picker-ptbr";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "list";

interface Patient {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  address?: string | null;
  profession?: string | null;
  createdAt: string;
}

function calcAge(birthDate?: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

function formatDate(date?: string | null): string | null {
  if (!date) return null;
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}

export default function PatientsList() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("patients_view_mode") as ViewMode) ?? "cards";
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useListPatients({ search: debouncedSearch, limit: 50 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("patients.create");

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("patients_view_mode", mode);
  }

  const patients = (data?.data ?? []) as Patient[];
  const total = data?.total ?? 0;

  return (
    <AppLayout title="Pacientes">
      <div className="space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-800">Pacientes</h1>
            <p className="text-sm text-slate-500">Gerencie o cadastro e prontuários dos pacientes</p>
          </div>
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 px-4 rounded-lg shadow-md shadow-primary/20">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] border-none shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                <CreatePatientForm onSuccess={() => { setIsDialogOpen(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total de pacientes",
              value: total,
              icon: <Users className="w-4 h-4" />,
              color: "text-primary",
            },
            {
              label: "Exibidos agora",
              value: patients.length,
              icon: <Search className="w-4 h-4" />,
              color: "text-sky-600",
            },
            {
              label: "Com e-mail cadastrado",
              value: patients.filter(p => p.email).length,
              icon: <Mail className="w-4 h-4" />,
              color: "text-emerald-600",
            },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={cn("shrink-0", s.color)}>{s.icon}</div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters + View toggle ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              className="pl-8 h-9 text-sm rounded-lg bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => changeView("cards")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "cards" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-500"
              )}
              title="Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => changeView("list")}
              className={cn(
                "p-1.5 transition-colors border-l border-slate-200",
                viewMode === "list" ? "bg-primary text-white" : "hover:bg-slate-50 text-slate-500"
              )}
              title="Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center shadow-sm">
            <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-display font-bold text-slate-800 mb-2">Nenhum paciente encontrado</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              {search
                ? "Tente ajustar os termos da sua busca."
                : "Comece cadastrando seu primeiro paciente para gerenciar prontuários e agendamentos."}
            </p>
            {!search && (
              <Button onClick={() => setIsDialogOpen(true)} className="h-12 px-8 rounded-xl">
                Cadastrar Primeiro Paciente
              </Button>
            )}
          </div>
        ) : viewMode === "cards" ? (
          <CardView patients={patients} />
        ) : (
          <ListView patients={patients} />
        )}

      </div>
    </AppLayout>
  );
}

// ─── Card View ────────────────────────────────────────────────────────────────

function CardView({ patients }: { patients: Patient[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {patients.map((patient) => {
        const age = calcAge(patient.birthDate);
        const initials = patient.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

        return (
          <Link key={patient.id} href={`/pacientes/${patient.id}`}>
            <div className="bg-white rounded-2xl border border-slate-200 cursor-pointer group hover:shadow-lg hover:border-primary/30 transition-all duration-200 overflow-hidden h-full">
              {/* top accent */}
              <div className="h-1 bg-gradient-to-r from-primary/60 to-primary" />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-slate-800 leading-tight truncate">
                        {patient.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">CPF: {displayCpf(patient.cpf)}</p>
                    </div>
                  </div>
                  {age && (
                    <span className="shrink-0 ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                      {age}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-600 gap-2.5">
                    <div className="p-1 bg-slate-100 rounded-md shrink-0">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="truncate">{patient.phone}</span>
                  </div>
                  {patient.email && (
                    <div className="flex items-center text-sm text-slate-600 gap-2.5">
                      <div className="p-1 bg-slate-100 rounded-md shrink-0">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="truncate">{patient.email}</span>
                    </div>
                  )}
                  {patient.address && (
                    <div className="flex items-center text-sm text-slate-600 gap-2.5">
                      <div className="p-1 bg-slate-100 rounded-md shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="truncate">{patient.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {patient.profession ? (
                    <span className="text-xs text-slate-400 truncate">{patient.profession}</span>
                  ) : (
                    <span />
                  )}
                  <span className="text-primary text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
                    Ver prontuário <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ patients }: { patients: Patient[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div
        className="grid items-center border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"
        style={{ gridTemplateColumns: "2fr 110px 140px 160px 110px 40px" }}
      >
        <span>Paciente</span>
        <span>Nascimento</span>
        <span>Telefone</span>
        <span>E-mail</span>
        <span>Profissão</span>
        <span />
      </div>

      {/* Rows */}
      {patients.map((patient, idx) => {
        const age = calcAge(patient.birthDate);
        const dob = formatDate(patient.birthDate);
        const initials = patient.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

        return (
          <Link key={patient.id} href={`/pacientes/${patient.id}`}>
            <div
              className={cn(
                "grid items-center px-4 py-3 hover:bg-primary/[0.03] transition-colors cursor-pointer group",
                idx !== patients.length - 1 && "border-b border-slate-100"
              )}
              style={{ gridTemplateColumns: "2fr 110px 140px 160px 110px 40px" }}
            >
              {/* Name + CPF */}
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{patient.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">CPF: {displayCpf(patient.cpf)}</p>
                </div>
              </div>

              {/* Birth date */}
              <div>
                {dob ? (
                  <div>
                    <p className="text-xs text-slate-700">{dob}</p>
                    {age && <p className="text-[11px] text-slate-400 mt-0.5">{age}</p>}
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Phone */}
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 truncate">{patient.phone}</span>
              </div>

              {/* Email */}
              <div className="min-w-0 pr-2">
                {patient.email ? (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 truncate">{patient.email}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Profession */}
              <div>
                {patient.profession ? (
                  <span className="text-xs text-slate-500 truncate block">{patient.profession}</span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-end">
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Create Patient Form ──────────────────────────────────────────────────────

function CreatePatientForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    birthDate: "",
    profession: "",
    address: "",
    emergencyContact: "",
    notes: "",
  });
  const mutation = useCreatePatient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      cpf: formData.cpf,
      phone: formData.phone,
      email: formData.email || undefined,
      birthDate: formData.birthDate || undefined,
      profession: formData.profession || undefined,
      address: formData.address || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      notes: formData.notes || undefined,
    };
    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Sucesso", description: "Paciente cadastrado com sucesso!" });
          onSuccess();
        },
        onError: (err: any) => {
          const message =
            err?.data?.message ?? err?.message ?? "Falha ao cadastrar paciente.";
          toast({ variant: "destructive", title: "Erro", description: message });
        },
      }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Novo Paciente</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome Completo *</Label>
          <Input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input
              required
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
              placeholder="000.000.000-00"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
              placeholder="(11) 99999-0000"
              className="h-11"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <DatePickerPTBR
              value={formData.birthDate}
              onChange={(v) => setFormData({ ...formData, birthDate: v })}
              className="h-11"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Profissão</Label>
            <Input
              value={formData.profession}
              onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
              placeholder="Ex: Professora"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Rua, número - Cidade"
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Contato de Emergência</Label>
          <Input
            value={formData.emergencyContact}
            onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
            placeholder="Nome e telefone do contato de emergência"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Anotações gerais sobre o paciente, histórico, alergias..."
            className="resize-none min-h-[80px]"
          />
        </div>
        <div className="pt-4 flex justify-end gap-3">
          <Button type="submit" className="h-11 px-8 rounded-xl" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Cadastro"}
          </Button>
        </div>
      </form>
    </>
  );
}
