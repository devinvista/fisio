import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetPatient,
  useGetAnamnesis,
  useCreateAnamnesis,
  useListEvaluations,
  useCreateEvaluation,
  useUpdateEvaluation,
  useDeleteEvaluation,
  useGetTreatmentPlan,
  useSaveTreatmentPlan,
  useListEvolutions,
  useCreateEvolution,
  useUpdateEvolution,
  useDeleteEvolution,
  useGetDischarge,
  useSaveDischarge,
  useUpdatePatient,
  useDeletePatient,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Phone, Mail, Calendar, Activity, ClipboardList, TrendingUp,
  FileText, DollarSign, History, Plus, ChevronDown, ChevronUp, User,
  MapPin, Stethoscope, Target, CheckCircle, Clock, XCircle, AlertCircle,
  LogOut, Pencil, Trash2, ShieldAlert, UserCheck, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePickerPTBR } from "@/components/ui/date-picker-ptbr";
import { useAuth } from "@/lib/auth-context";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  agendado: { label: "Agendado", color: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
  concluido: { label: "Concluído", color: "bg-slate-100 text-slate-700", icon: <CheckCircle className="w-3 h-3" /> },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  faltou: { label: "Faltou", color: "bg-orange-100 text-orange-700", icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoBlock({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ─── Anamnesis Tab ──────────────────────────────────────────────────────────────

function AnamnesisTab({ patientId }: { patientId: number }) {
  const { data, isLoading } = useGetAnamnesis(patientId);
  const mutation = useCreateAnamnesis();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    mainComplaint: "", diseaseHistory: "", medicalHistory: "",
    medications: "", allergies: "", familyHistory: "", lifestyle: "", painScale: 0,
  });

  useEffect(() => {
    if (data) {
      setForm({
        mainComplaint: data.mainComplaint || "",
        diseaseHistory: data.diseaseHistory || "",
        medicalHistory: data.medicalHistory || "",
        medications: data.medications || "",
        allergies: data.allergies || "",
        familyHistory: data.familyHistory || "",
        lifestyle: data.lifestyle || "",
        painScale: data.painScale || 0,
      });
    }
  }, [data]);

  const handleSave = () => {
    mutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Salvo com sucesso", description: "Anamnese atualizada." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/anamnesis`] });
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-xl">Ficha de Anamnese</CardTitle>
            <CardDescription>Histórico completo de saúde do paciente</CardDescription>
          </div>
          {data?.updatedAt && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
              <Clock className="w-3 h-3" />
              Atualizado em {formatDateTime(data.updatedAt)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Queixa Principal (QP)</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.mainComplaint} onChange={e => setForm({ ...form, mainComplaint: e.target.value })}
            placeholder="Relato do paciente sobre o motivo da consulta..." />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">História da Doença Atual (HDA)</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.diseaseHistory} onChange={e => setForm({ ...form, diseaseHistory: e.target.value })}
            placeholder="Evolução dos sintomas, início, fatores agravantes..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Histórico Médico (HMP)</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.medicalHistory} onChange={e => setForm({ ...form, medicalHistory: e.target.value })}
              placeholder="Cirurgias, internações, doenças..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Medicamentos em Uso</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.medications} onChange={e => setForm({ ...form, medications: e.target.value })}
              placeholder="Nome e dosagem dos medicamentos..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Alergias</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })}
              placeholder="Alergias a medicamentos, alimentos..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Histórico Familiar</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
              value={form.familyHistory} onChange={e => setForm({ ...form, familyHistory: e.target.value })}
              placeholder="Doenças hereditárias, histórico familiar..." />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Estilo de Vida</Label>
          <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.lifestyle} onChange={e => setForm({ ...form, lifestyle: e.target.value })}
            placeholder="Atividade física, sono, alimentação, trabalho..." />
        </div>
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-semibold text-slate-700">Escala de Dor (EVA)</Label>
            <span className={`font-bold text-xl ${form.painScale >= 7 ? "text-red-500" : form.painScale >= 4 ? "text-orange-500" : "text-green-500"}`}>
              {form.painScale} / 10
            </span>
          </div>
          <Slider value={[form.painScale]} max={10} step={1}
            onValueChange={val => setForm({ ...form, painScale: val[0] })} className="py-2" />
          <div className="flex justify-between text-xs font-medium text-slate-400">
            <span>Sem dor (0)</span><span>Moderada (5)</span><span>Insuportável (10)</span>
          </div>
        </div>
        <div className="pt-3 flex justify-end">
          <Button onClick={handleSave} className="h-11 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Anamnese
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Evaluations Tab ────────────────────────────────────────────────────────────

const emptyEvalForm = { inspection: "", posture: "", rangeOfMotion: "", muscleStrength: "", orthopedicTests: "", functionalDiagnosis: "" };

function EvaluationsTab({ patientId }: { patientId: number }) {
  const { data: evaluations = [], isLoading } = useListEvaluations(patientId);
  const createMutation = useCreateEvaluation();
  const updateMutation = useUpdateEvaluation();
  const deleteMutation = useDeleteEvaluation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyEvalForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/evaluations`] });

  const handleCreate = () => {
    createMutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Avaliação criada", description: "Nova avaliação registrada com sucesso." });
        invalidate();
        setForm(emptyEvalForm);
        setShowForm(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    updateMutation.mutate({ patientId, evaluationId: id, data: form }, {
      onSuccess: () => {
        toast({ title: "Avaliação atualizada", description: "Alterações salvas com sucesso." });
        invalidate();
        setEditingId(null);
        setForm(emptyEvalForm);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Excluir esta avaliação permanentemente?")) return;
    deleteMutation.mutate({ patientId, evaluationId: id }, {
      onSuccess: () => {
        toast({ title: "Avaliação excluída" });
        invalidate();
        if (expandedId === id) setExpandedId(null);
      },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setExpandedId(null);
    setShowForm(false);
    setForm({
      inspection: ev.inspection || "",
      posture: ev.posture || "",
      rangeOfMotion: ev.rangeOfMotion || "",
      muscleStrength: ev.muscleStrength || "",
      orthopedicTests: ev.orthopedicTests || "",
      functionalDiagnosis: ev.functionalDiagnosis || "",
    });
  };

  const EvalForm = ({ onSave, onCancel, saving, title }: { onSave: () => void; onCancel: () => void; saving: boolean; title: string }) => (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "inspection", label: "Inspeção", placeholder: "Postura geral, assimetrias observadas..." },
            { key: "posture", label: "Postura", placeholder: "Análise anterior, posterior e lateral..." },
            { key: "rangeOfMotion", label: "Amplitude de Movimento", placeholder: "Graus de movimento, limitações..." },
            { key: "muscleStrength", label: "Força Muscular", placeholder: "Graus de força (0-5), grupos musculares..." },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">{f.label}</Label>
              <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Testes Ortopédicos</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.orthopedicTests} onChange={e => setForm({ ...form, orthopedicTests: e.target.value })}
            placeholder="Testes realizados e resultados..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Diagnóstico Funcional</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.functionalDiagnosis} onChange={e => setForm({ ...form, functionalDiagnosis: e.target.value })}
            placeholder="Conclusão da avaliação e objetivos do tratamento..." />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-xl" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Avaliação
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Avaliações Físicas</h3>
          <p className="text-sm text-slate-500">{evaluations.length} avaliação(ões) registrada(s)</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyEvalForm); }} className="h-10 px-5 rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Nova Avaliação
        </Button>
      </div>

      {showForm && !editingId && (
        <EvalForm
          title="Nova Avaliação Fisioterapêutica"
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(emptyEvalForm); }}
          saving={createMutation.isPending}
        />
      )}

      {evaluations.length === 0 && !showForm ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma avaliação registrada</p>
            <p className="text-sm mt-1">Clique em "Nova Avaliação" para adicionar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev, idx) => (
            <div key={ev.id}>
              {editingId === ev.id ? (
                <EvalForm
                  title={`Editar Avaliação #${evaluations.length - idx}`}
                  onSave={() => handleUpdate(ev.id)}
                  onCancel={() => { setEditingId(null); setForm(emptyEvalForm); }}
                  saving={updateMutation.isPending}
                />
              ) : (
                <Card className="border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <button
                      className="flex items-center gap-3 flex-1 text-left"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        {evaluations.length - idx}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Avaliação #{evaluations.length - idx}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(ev.createdAt)}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                        onClick={() => startEdit(ev)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                        onClick={() => handleDelete(ev.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {expandedId === ev.id ? <ChevronUp className="w-4 h-4 text-slate-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />}
                    </div>
                  </div>
                  {expandedId === ev.id && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      {ev.inspection && <InfoBlock label="Inspeção" value={ev.inspection} />}
                      {ev.posture && <InfoBlock label="Postura" value={ev.posture} />}
                      {ev.rangeOfMotion && <InfoBlock label="Amplitude de Movimento" value={ev.rangeOfMotion} />}
                      {ev.muscleStrength && <InfoBlock label="Força Muscular" value={ev.muscleStrength} />}
                      {ev.orthopedicTests && <InfoBlock label="Testes Ortopédicos" value={ev.orthopedicTests} className="md:col-span-2" />}
                      {ev.functionalDiagnosis && <InfoBlock label="Diagnóstico Funcional" value={ev.functionalDiagnosis} className="md:col-span-2" />}
                    </div>
                  )}
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Treatment Plan Tab ─────────────────────────────────────────────────────────

function TreatmentPlanTab({ patientId }: { patientId: number }) {
  const { data, isLoading } = useGetTreatmentPlan(patientId);
  const mutation = useSaveTreatmentPlan();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  const completedSessions = appointments.filter((a: any) => a.status === "concluido").length;

  const [form, setForm] = useState({
    objectives: "", techniques: "", frequency: "",
    estimatedSessions: "" as string | number,
    status: "ativo" as "ativo" | "concluido" | "suspenso",
  });

  useEffect(() => {
    if (data) {
      setForm({
        objectives: data.objectives || "",
        techniques: data.techniques || "",
        frequency: data.frequency || "",
        estimatedSessions: data.estimatedSessions || "",
        status: (data.status as "ativo" | "concluido" | "suspenso") || "ativo",
      });
    }
  }, [data]);

  const handleSave = () => {
    mutation.mutate({
      patientId,
      data: { ...form, estimatedSessions: form.estimatedSessions ? Number(form.estimatedSessions) : undefined },
    }, {
      onSuccess: () => {
        toast({ title: "Salvo com sucesso", description: "Plano de tratamento atualizado." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/treatment-plan`] });
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const statusStyles = {
    ativo: "bg-green-100 text-green-700",
    concluido: "bg-slate-100 text-slate-700",
    suspenso: "bg-orange-100 text-orange-700",
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">Plano de Tratamento</CardTitle>
            <CardDescription>Objetivos, técnicas e frequência do tratamento</CardDescription>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[form.status]}`}>
            {form.status === "ativo" ? "Ativo" : form.status === "concluido" ? "Concluído" : "Suspenso"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Objetivos do Tratamento
          </Label>
          <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })}
            placeholder="Quais os objetivos terapêuticos a serem alcançados..." />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Técnicas e Recursos
          </Label>
          <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
            value={form.techniques} onChange={e => setForm({ ...form, techniques: e.target.value })}
            placeholder="Técnicas fisioterapêuticas, eletroterapia, exercícios..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Frequência das Sessões</Label>
            <Input className="bg-slate-50 border-slate-200 focus:bg-white"
              value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
              placeholder="Ex: 3x por semana, quinzenal..." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Sessões Estimadas</Label>
            <Input type="number" min={1} className="bg-slate-50 border-slate-200 focus:bg-white"
              value={form.estimatedSessions} onChange={e => setForm({ ...form, estimatedSessions: e.target.value })}
              placeholder="Ex: 20" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Status do Tratamento</Label>
          <Select value={form.status} onValueChange={(v: "ativo" | "concluido" | "suspenso") => setForm({ ...form, status: v })}>
            <SelectTrigger className="bg-slate-50 border-slate-200 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Session progress */}
        {(form.estimatedSessions || completedSessions > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Progresso de Sessões
              </Label>
              <span className={`text-sm font-bold ${
                form.estimatedSessions && completedSessions >= Number(form.estimatedSessions)
                  ? "text-green-600"
                  : "text-primary"
              }`}>
                {completedSessions} / {form.estimatedSessions || "—"}
              </span>
            </div>
            {form.estimatedSessions ? (
              <>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      completedSessions >= Number(form.estimatedSessions)
                        ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, (completedSessions / Number(form.estimatedSessions)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {completedSessions >= Number(form.estimatedSessions)
                    ? "Meta atingida! Considere registrar a alta."
                    : `${Math.max(0, Number(form.estimatedSessions) - completedSessions)} sessão(ões) restante(s)`}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">{completedSessions} sessão(ões) concluída(s). Defina o total estimado para ver o progresso.</p>
            )}
          </div>
        )}

        <div className="pt-3 flex justify-end">
          <Button onClick={handleSave} className="h-11 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Evolutions Tab ─────────────────────────────────────────────────────────────

const emptyEvoForm = { appointmentId: "" as string | number, description: "", patientResponse: "", clinicalNotes: "", complications: "" };

function EvolutionsTab({ patientId }: { patientId: number }) {
  const { data: evolutions = [], isLoading } = useListEvolutions(patientId);
  const createMutation = useCreateEvolution();
  const updateMutation = useUpdateEvolution();
  const deleteMutation = useDeleteEvolution();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyEvoForm);

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/evolutions`] });

  const sortedApptsByDate = [...appointments].sort((a: any, b: any) =>
    new Date(a.date + "T" + (a.startTime || "00:00")).getTime() -
    new Date(b.date + "T" + (b.startTime || "00:00")).getTime()
  );

  const getSessionNumber = (ev: any, fallbackIdx: number): number => {
    if (ev.appointmentId) {
      const pos = sortedApptsByDate.findIndex((a: any) => a.id === ev.appointmentId);
      if (pos !== -1) return pos + 1;
    }
    return evolutions.length - fallbackIdx;
  };

  const buildPayload = () => ({
    ...form,
    appointmentId: form.appointmentId ? Number(form.appointmentId) : undefined,
  });

  const handleCreate = () => {
    createMutation.mutate({ patientId, data: buildPayload() }, {
      onSuccess: () => {
        toast({ title: "Evolução registrada", description: "Anotação de evolução salva com sucesso." });
        invalidate();
        setForm(emptyEvoForm);
        setShowForm(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    updateMutation.mutate({ patientId, evolutionId: id, data: buildPayload() }, {
      onSuccess: () => {
        toast({ title: "Evolução atualizada", description: "Alterações salvas com sucesso." });
        invalidate();
        setEditingId(null);
        setForm(emptyEvoForm);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Excluir esta evolução permanentemente?")) return;
    deleteMutation.mutate({ patientId, evolutionId: id }, {
      onSuccess: () => { toast({ title: "Evolução excluída" }); invalidate(); },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setShowForm(false);
    setForm({
      appointmentId: ev.appointmentId || "",
      description: ev.description || "",
      patientResponse: ev.patientResponse || "",
      clinicalNotes: ev.clinicalNotes || "",
      complications: ev.complications || "",
    });
  };

  const EvoForm = ({ onSave, onCancel, saving, title }: { onSave: () => void; onCancel: () => void; saving: boolean; title: string }) => (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Consulta Vinculada <span className="text-slate-400 font-normal">(opcional)</span></Label>
          <Select
            value={String(form.appointmentId || "")}
            onValueChange={v => setForm({ ...form, appointmentId: v === "none" ? "" : v })}
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Selecionar consulta..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma consulta vinculada</SelectItem>
              {appointments.map((appt: any) => (
                <SelectItem key={appt.id} value={String(appt.id)}>
                  {formatDate(appt.date)} — {appt.startTime} — {appt.procedure?.name || "Consulta"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Descrição da Sessão</Label>
          <Textarea className="min-h-[90px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="O que foi realizado na sessão de hoje..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Resposta do Paciente</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
              value={form.patientResponse} onChange={e => setForm({ ...form, patientResponse: e.target.value })}
              placeholder="Como o paciente respondeu ao tratamento..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Notas Clínicas</Label>
            <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 resize-none text-sm"
              value={form.clinicalNotes} onChange={e => setForm({ ...form, clinicalNotes: e.target.value })}
              placeholder="Observações clínicas relevantes..." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Intercorrências</Label>
          <Textarea className="min-h-[70px] bg-slate-50 border-slate-200 resize-none text-sm"
            value={form.complications} onChange={e => setForm({ ...form, complications: e.target.value })}
            placeholder="Alguma intercorrência ou evento adverso..." />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-xl" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Evolução
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Evoluções de Sessão</h3>
          <p className="text-sm text-slate-500">{evolutions.length} evolução(ões) registrada(s)</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyEvoForm); }} className="h-10 px-5 rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Nova Evolução
        </Button>
      </div>

      {showForm && !editingId && (
        <EvoForm
          title="Registrar Evolução de Sessão"
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(emptyEvoForm); }}
          saving={createMutation.isPending}
        />
      )}

      {evolutions.length === 0 && !showForm ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma evolução registrada</p>
            <p className="text-sm mt-1">Registre evoluções após cada sessão.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {evolutions.map((ev, idx) => {
              const linkedAppt = appointments.find((a: any) => a.id === ev.appointmentId);
              const sessionNum = getSessionNumber(ev, idx);
              return (
                <div key={ev.id} className="relative flex gap-4 pl-10">
                  <div className="absolute left-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                    {sessionNum}
                  </div>
                  {editingId === ev.id ? (
                    <div className="flex-1">
                      <EvoForm
                        title={`Editar Sessão #${sessionNum}`}
                        onSave={() => handleUpdate(ev.id)}
                        onCancel={() => { setEditingId(null); setForm(emptyEvoForm); }}
                        saving={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    <Card className="flex-1 border border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs text-slate-400 font-medium">{formatDateTime(ev.createdAt)}</p>
                            {linkedAppt && (
                              <p className="text-xs text-primary font-medium mt-0.5">
                                📅 Consulta: {formatDate(linkedAppt.date)} — {linkedAppt.startTime} — {linkedAppt.procedure?.name || "Consulta"}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-primary"
                              onClick={() => startEdit(ev)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                              onClick={() => handleDelete(ev.id)} disabled={deleteMutation.isPending}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ev.description && <InfoBlock label="Sessão" value={ev.description} className="md:col-span-2" />}
                          {ev.patientResponse && <InfoBlock label="Resposta do Paciente" value={ev.patientResponse} />}
                          {ev.clinicalNotes && <InfoBlock label="Notas Clínicas" value={ev.clinicalNotes} />}
                          {ev.complications && <InfoBlock label="Intercorrências" value={ev.complications} className="md:col-span-2" />}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Appointment History Tab ────────────────────────────────────────────────────

function HistoryTab({ patientId }: { patientId: number }) {
  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    queryFn: () => fetch(`/api/patients/${patientId}/appointments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Histórico de Consultas</h3>
        <p className="text-sm text-slate-500">{appointments.length} consulta(s) registrada(s)</p>
      </div>

      {appointments.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma consulta registrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt: any) => {
            const cfg = statusConfig[appt.status] || statusConfig.agendado;
            return (
              <Card key={appt.id} className="border border-slate-200 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                    <span className="text-lg font-bold leading-none">{new Date(appt.date).getDate()}</span>
                    <span className="text-[10px] uppercase font-medium opacity-70">
                      {format(new Date(appt.date), "MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{appt.procedure?.name || "Procedimento não informado"}</p>
                    <p className="text-sm text-slate-500">{appt.startTime} — {appt.endTime} &bull; {formatDate(appt.date)}</p>
                    {appt.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{appt.notes}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Financial Tab ──────────────────────────────────────────────────────────────

const emptyPayForm = { type: "receita" as "receita" | "despesa", amount: "", description: "", category: "" };

function FinancialTab({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/patients/${patientId}/financial`],
    queryFn: () => fetch(`/api/patients/${patientId}/financial`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}` }
    }).then(r => r.json()),
    enabled: !!patientId,
  });

  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm);
  const [saving, setSaving] = useState(false);

  const handleRegisterPayment = async () => {
    if (!payForm.amount || !payForm.description) {
      toast({ title: "Preencha valor e descrição", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/financial/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("fisiogest_token")}`,
        },
        body: JSON.stringify({ ...payForm, amount: Number(payForm.amount), patientId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Registro salvo", description: "Transação registrada com sucesso." });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/financial`] });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      setPayForm(emptyPayForm);
      setShowPayForm(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  const totalReceitas = records.filter((r: any) => r.type === "receita").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalDespesas = records.filter((r: any) => r.type === "despesa").reduce((s: number, r: any) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Histórico Financeiro</h3>
          <p className="text-sm text-slate-500">{records.length} transação(ões) registrada(s)</p>
        </div>
        <Button
          onClick={() => { setShowPayForm(!showPayForm); setPayForm(emptyPayForm); }}
          className="h-10 px-4 rounded-xl text-sm"
          variant={showPayForm ? "outline" : "default"}
        >
          <Plus className="w-4 h-4 mr-2" />
          {showPayForm ? "Cancelar" : "Registrar Transação"}
        </Button>
      </div>

      {showPayForm && (
        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Nova Transação Financeira
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Tipo</Label>
                <Select value={payForm.type} onValueChange={(v: "receita" | "despesa") => setPayForm({ ...payForm, type: v })}>
                  <SelectTrigger className="bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita (pagamento recebido)</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Valor (R$) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="bg-slate-50 border-slate-200 focus:bg-white"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="Ex: 150.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Descrição <span className="text-red-500">*</span></Label>
              <Input
                className="bg-slate-50 border-slate-200 focus:bg-white"
                value={payForm.description}
                onChange={e => setPayForm({ ...payForm, description: e.target.value })}
                placeholder="Ex: Pagamento de sessão, Avaliação inicial…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Categoria <span className="text-slate-400 font-normal">(opcional)</span></Label>
              <Input
                className="bg-slate-50 border-slate-200 focus:bg-white"
                value={payForm.category}
                onChange={e => setPayForm({ ...payForm, category: e.target.value })}
                placeholder="Ex: Fisioterapia, Pilates…"
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowPayForm(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleRegisterPayment} disabled={saving} className="rounded-xl">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar Transação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-none bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Total Recebido</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
          </CardContent>
        </Card>
        <Card className="border-none bg-gradient-to-br from-red-50 to-rose-50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Total Despesas</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card className="border-none bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">Saldo</p>
            <p className={`text-xl font-bold ${totalReceitas - totalDespesas >= 0 ? "text-slate-800" : "text-red-600"}`}>
              {formatCurrency(totalReceitas - totalDespesas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="p-12 text-center text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma transação registrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record: any) => (
            <Card key={record.id} className="border border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${record.type === "receita" ? "bg-green-100" : "bg-red-100"}`}>
                  <DollarSign className={`w-5 h-5 ${record.type === "receita" ? "text-green-600" : "text-red-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{record.description}</p>
                  <p className="text-xs text-slate-500">
                    {record.procedure?.name && `${record.procedure.name} • `}
                    {formatDateTime(record.createdAt)}
                    {record.category && ` • ${record.category}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-base font-bold ${record.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {record.type === "receita" ? "+" : "-"}{formatCurrency(record.amount)}
                  </p>
                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${record.type === "receita" ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}`}>
                    {record.type === "receita" ? "Receita" : "Despesa"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Discharge Tab ──────────────────────────────────────────────────────────────

const DISCHARGE_REASONS = [
  "Objetivo alcançado",
  "Alta a pedido do paciente",
  "Encaminhamento para outro serviço",
  "Abandono de tratamento",
  "Sem resposta ao tratamento",
  "Outro",
];

function DischargeTab({ patientId }: { patientId: number }) {
  const { data, isLoading } = useGetDischarge(patientId);
  const mutation = useSaveDischarge();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ dischargeDate: today, dischargeReason: "", achievedResults: "", recommendations: "" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        dischargeDate: data.dischargeDate || today,
        dischargeReason: data.dischargeReason || "",
        achievedResults: data.achievedResults || "",
        recommendations: data.recommendations || "",
      });
    }
  }, [data]);

  const showForm = (!data && !isLoading) || editing;

  const handleSave = () => {
    if (!form.dischargeReason || !form.dischargeDate) return;
    mutation.mutate({ patientId, data: form }, {
      onSuccess: () => {
        toast({ title: "Alta registrada", description: "Documento de alta fisioterapêutica salvo com sucesso." });
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/discharge-summary`] });
        setEditing(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Alta Fisioterapêutica</h3>
          <p className="text-sm text-slate-500">Exigência regulatória COFFITO — finalização formal do tratamento</p>
        </div>
        {data && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)} className="h-9 px-4 rounded-xl text-sm">
            Editar Alta
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Requisito COFFITO:</span> Todo prontuário deve conter o documento de alta com motivo, resultados e recomendações para o paciente.
        </p>
      </div>

      {showForm ? (
        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <LogOut className="w-4 h-4 text-primary" />
              {data ? "Editar Alta Fisioterapêutica" : "Registrar Alta Fisioterapêutica"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Data da Alta <span className="text-red-500">*</span></Label>
              <DatePickerPTBR value={form.dischargeDate} onChange={v => setForm({ ...form, dischargeDate: v })} className="bg-slate-50 border-slate-200 max-w-xs" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Motivo da Alta <span className="text-red-500">*</span></Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DISCHARGE_REASONS.map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm({ ...form, dischargeReason: r })}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.dischargeReason === r
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <Textarea className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none text-sm"
                value={form.dischargeReason}
                onChange={e => setForm({ ...form, dischargeReason: e.target.value })}
                placeholder="Selecione uma opção acima ou descreva o motivo da alta..." />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Resultados Alcançados</Label>
              <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                value={form.achievedResults} onChange={e => setForm({ ...form, achievedResults: e.target.value })}
                placeholder="Descreva a evolução funcional, redução de dor, ganhos de amplitude e força muscular..." />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Recomendações ao Paciente</Label>
              <Textarea className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })}
                placeholder="Orientações pós-alta: exercícios domiciliares, cuidados posturais, retorno se necessário..." />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              {editing && (
                <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">Cancelar</Button>
              )}
              <Button onClick={handleSave}
                disabled={mutation.isPending || !form.dischargeReason || !form.dischargeDate}
                className="h-11 px-8 rounded-xl shadow-md shadow-primary/20">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                Registrar Alta
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : data ? (
        <Card className="border-none shadow-md overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-800">Alta Concedida</CardTitle>
                  <p className="text-xs text-slate-500">
                    {formatDate(data.dischargeDate)} &bull; Registrado em {formatDateTime(data.updatedAt)}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <CheckCircle className="w-3.5 h-3.5" /> Alta Concedida
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <InfoBlock label="Motivo da Alta" value={data.dischargeReason} />
            {data.achievedResults && <InfoBlock label="Resultados Alcançados" value={data.achievedResults} />}
            {data.recommendations && <InfoBlock label="Recomendações ao Paciente" value={data.recommendations} />}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Edit Patient Dialog ─────────────────────────────────────────────────────────

interface PatientData {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  address?: string | null;
  profession?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
}

function EditPatientDialog({
  patient,
  open,
  onClose,
  onSaved,
}: {
  patient: PatientData;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hasPermission, hasRole } = useAuth();
  const { toast } = useToast();
  const mutation = useUpdatePatient();
  const isAdmin = hasRole("admin");

  const [form, setForm] = useState({
    name: patient.name ?? "",
    cpf: patient.cpf ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    birthDate: patient.birthDate ?? "",
    address: patient.address ?? "",
    profession: patient.profession ?? "",
    emergencyContact: patient.emergencyContact ?? "",
    notes: patient.notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: patient.name ?? "",
        cpf: patient.cpf ?? "",
        phone: patient.phone ?? "",
        email: patient.email ?? "",
        birthDate: patient.birthDate ?? "",
        address: patient.address ?? "",
        profession: patient.profession ?? "",
        emergencyContact: patient.emergencyContact ?? "",
        notes: patient.notes ?? "",
      });
    }
  }, [open, patient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { id: patient.id, data: form },
      {
        onSuccess: () => {
          toast({ title: "Cadastro atualizado", description: "Os dados do paciente foram salvos com sucesso." });
          onSaved();
          onClose();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Não foi possível atualizar o cadastro.";
          toast({ variant: "destructive", title: "Erro ao salvar", description: msg });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" /> Editar Cadastro
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {isAdmin
              ? "Todos os campos estão disponíveis para edição."
              : "Você pode editar dados de contato e informações pessoais."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Identidade (somente admin) ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Identificação
              {!isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-300 normal-case tracking-normal font-normal">
                  <Lock className="w-3 h-3" /> restrito ao administrador
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Nome Completo *</Label>
                <Input
                  required
                  disabled={!isAdmin}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">CPF *</Label>
                <Input
                  required
                  disabled={!isAdmin}
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="h-10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* ── Contato ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contato</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Telefone *</Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* ── Dados Pessoais ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Dados Pessoais</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Data de Nascimento</Label>
                <DatePickerPTBR
                  value={form.birthDate}
                  onChange={(v) => setForm({ ...form, birthDate: v })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Profissão</Label>
                <Input
                  value={form.profession}
                  onChange={(e) => setForm({ ...form, profession: e.target.value })}
                  placeholder="Ex: Professora"
                  className="h-10"
                />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Rua, número - Bairro - Cidade"
                className="h-10"
              />
            </div>
          </div>

          {/* ── Emergência + Notas ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Informações Adicionais</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Contato de Emergência
                </Label>
                <Input
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  placeholder="Nome — Telefone — Parentesco"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observações clínicas ou administrativas relevantes..."
                  className="min-h-[80px] bg-slate-50 border-slate-200 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" className="h-10 px-8 rounded-xl shadow-md shadow-primary/20" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function PatientDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const patientId = Number(id);
  const { data: patient, isLoading, refetch } = useGetPatient(patientId);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const deleteMutation = useDeletePatient();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = hasPermission("patients.update");
  const canDelete = hasPermission("patients.delete");

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: patientId },
      {
        onSuccess: () => {
          toast({ title: "Paciente excluído", description: "O cadastro foi removido permanentemente." });
          setLocation("/pacientes");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível excluir o paciente." });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Carregando...">
        <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout title="Paciente não encontrado">
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
          <User className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Paciente não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Prontuário do Paciente">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dialogs */}
        {canEdit && (
          <EditPatientDialog
            patient={patient as PatientData}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
              refetch();
            }}
          />
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente e removerá <strong>{patient.name}</strong> e todos os seus dados clínicos. Esta operação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Sim, excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="h-28 bg-gradient-to-r from-primary to-primary/60" />
            <CardContent className="px-5 pb-5 pt-0 relative">
              <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center text-3xl font-bold text-primary border-4 border-white -mt-10 mb-3">
                {patient.name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-foreground leading-tight">{patient.name}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mt-1 mb-4">
                Paciente Ativo
              </span>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" /> {patient.phone}
                </div>
                {patient.email && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" /> {patient.email}
                  </div>
                )}
                {patient.birthDate && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {formatDate(patient.birthDate)}
                      <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        {differenceInYears(new Date(), parseISO(patient.birthDate))} anos
                      </span>
                    </span>
                  </div>
                )}
                {patient.address && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> {patient.address}
                  </div>
                )}
                {patient.profession && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <UserCheck className="w-4 h-4 text-slate-400 shrink-0" /> {patient.profession}
                  </div>
                )}
                {patient.emergencyContact && (
                  <div className="flex items-start gap-2.5 text-slate-600">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-amber-600 font-semibold uppercase leading-none mb-0.5">Contato de Emergência</p>
                      <p className="text-sm text-slate-700">{patient.emergencyContact}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Consultas</p>
                  <p className="text-2xl font-bold text-slate-800">{patient.totalAppointments || 0}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Total Gasto</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(patient.totalSpent || 0)}</p>
                </div>
              </div>
              {patient.cpf && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mb-0.5">CPF</p>
                  <p className="text-sm font-medium text-slate-700">{patient.cpf}</p>
                </div>
              )}
              {patient.notes && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] text-amber-700 font-semibold uppercase mb-0.5">Observações</p>
                  <p className="text-xs text-amber-800">{patient.notes}</p>
                </div>
              )}

              {/* ── Action buttons ── */}
              {(canEdit || canDelete) && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="w-full h-9 rounded-xl text-sm border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Editar Cadastro
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="w-full h-9 rounded-xl text-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir Paciente
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="anamnesis" className="w-full">
            <div className="mb-5 space-y-1">
              {/* Main 6 tabs — scrollable on mobile, 3-col grid on md+ */}
              <TabsList className="w-full bg-white p-1 rounded-xl shadow-sm border border-slate-200 h-auto flex flex-wrap gap-1">
                {[
                  { value: "anamnesis",   icon: <ClipboardList className="w-3.5 h-3.5 shrink-0" />, label: "Anamnese" },
                  { value: "evaluations", icon: <Activity className="w-3.5 h-3.5 shrink-0" />,      label: "Avaliações" },
                  { value: "treatment",   icon: <Target className="w-3.5 h-3.5 shrink-0" />,         label: "Plano Trat." },
                  { value: "evolutions",  icon: <TrendingUp className="w-3.5 h-3.5 shrink-0" />,     label: "Evoluções" },
                  { value: "history",     icon: <History className="w-3.5 h-3.5 shrink-0" />,        label: "Histórico" },
                  { value: "financial",   icon: <DollarSign className="w-3.5 h-3.5 shrink-0" />,     label: "Financeiro" },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-1 basis-[calc(33.33%-4px)] min-w-[90px] rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white text-xs py-2.5 flex items-center justify-center gap-1.5"
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Alta tab — always full width, visually distinct */}
              <TabsList className="w-full bg-white p-1 rounded-xl shadow-sm border border-dashed border-slate-300 h-auto">
                <TabsTrigger
                  value="discharge"
                  className="w-full rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white text-xs py-2 flex items-center justify-center gap-1.5 data-[state=inactive]:text-slate-500"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" /> Alta Fisioterapêutica (COFFITO)
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="anamnesis"><AnamnesisTab patientId={patientId} /></TabsContent>
            <TabsContent value="evaluations"><EvaluationsTab patientId={patientId} /></TabsContent>
            <TabsContent value="treatment"><TreatmentPlanTab patientId={patientId} /></TabsContent>
            <TabsContent value="evolutions"><EvolutionsTab patientId={patientId} /></TabsContent>
            <TabsContent value="history"><HistoryTab patientId={patientId} /></TabsContent>
            <TabsContent value="financial"><FinancialTab patientId={patientId} /></TabsContent>
            <TabsContent value="discharge"><DischargeTab patientId={patientId} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
