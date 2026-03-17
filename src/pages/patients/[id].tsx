import { useParams } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetPatient, useGetAnamnesis, useCreateAnamnesis } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Phone, Mail, MapPin, Calendar, Activity, ClipboardList, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PatientDetail() {
  const { id } = useParams();
  const patientId = Number(id);
  const { data: patient, isLoading } = useGetPatient(patientId);

  if (isLoading || !patient) {
    return <AppLayout title="Carregando..."><div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout title="Prontuário do Paciente">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Patient Profile Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardContent className="px-6 pb-6 pt-0 relative">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center text-4xl font-bold text-primary border-4 border-white -mt-12 mb-4">
                {patient.name.charAt(0)}
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-1">{patient.name}</h2>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-6">
                Paciente Ativo
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" /> {patient.phone}
                </div>
                {patient.email && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" /> {patient.email}
                  </div>
                )}
                {patient.birthDate && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" /> Nasc: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium uppercase mb-1">Consultas</p>
                  <p className="text-xl font-bold text-slate-800">{patient.totalAppointments || 0}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium uppercase mb-1">Total Gasto</p>
                  <p className="text-lg font-bold text-slate-800">R$ {patient.totalSpent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="anamnesis" className="w-full">
            <TabsList className="w-full bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="anamnesis" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white flex-1 py-3"><ClipboardList className="w-4 h-4 mr-2"/> Anamnese</TabsTrigger>
              <TabsTrigger value="evaluations" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white flex-1 py-3"><Activity className="w-4 h-4 mr-2"/> Avaliações</TabsTrigger>
              <TabsTrigger value="evolutions" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white flex-1 py-3"><TrendingUp className="w-4 h-4 mr-2"/> Evoluções</TabsTrigger>
            </TabsList>
            
            <TabsContent value="anamnesis">
              <AnamnesisTab patientId={patientId} />
            </TabsContent>
            
            <TabsContent value="evaluations">
              <Card className="border-none shadow-md"><CardContent className="p-10 text-center text-muted-foreground">Módulo de avaliações em construção</CardContent></Card>
            </TabsContent>
            
            <TabsContent value="evolutions">
              <Card className="border-none shadow-md"><CardContent className="p-10 text-center text-muted-foreground">Módulo de evoluções em construção</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

function AnamnesisTab({ patientId }: { patientId: number }) {
  const { data, isLoading } = useGetAnamnesis(patientId);
  const mutation = useCreateAnamnesis();
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    mainComplaint: "",
    diseaseHistory: "",
    medicalHistory: "",
    medications: "",
    painScale: 0
  });

  useEffect(() => {
    if (data) {
      setForm({
        mainComplaint: data.mainComplaint || "",
        diseaseHistory: data.diseaseHistory || "",
        medicalHistory: data.medicalHistory || "",
        medications: data.medications || "",
        painScale: data.painScale || 0
      });
    }
  }, [data]);

  const handleSave = () => {
    mutation.mutate({ patientId, data: form }, {
      onSuccess: () => toast({ title: "Salvo", description: "Anamnese atualizada." })
    });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-xl">Ficha de Anamnese</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
          <Label className="text-base">Queixa Principal (QP)</Label>
          <Textarea 
            className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white" 
            value={form.mainComplaint} 
            onChange={e => setForm({...form, mainComplaint: e.target.value})}
            placeholder="Relato do paciente sobre o motivo da consulta..."
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-base">História da Doença Atual (HDA)</Label>
          <Textarea 
            className="min-h-[100px] bg-slate-50 border-slate-200 focus:bg-white" 
            value={form.diseaseHistory} 
            onChange={e => setForm({...form, diseaseHistory: e.target.value})}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base">Histórico Médico (HMP)</Label>
            <Textarea 
              className="bg-slate-50 border-slate-200 focus:bg-white" 
              value={form.medicalHistory} 
              onChange={e => setForm({...form, medicalHistory: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Medicamentos em Uso</Label>
            <Textarea 
              className="bg-slate-50 border-slate-200 focus:bg-white" 
              value={form.medications} 
              onChange={e => setForm({...form, medications: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <Label className="text-base">Escala de Dor (EVA)</Label>
            <span className="font-bold text-xl text-primary">{form.painScale} / 10</span>
          </div>
          <Slider 
            value={[form.painScale]} 
            max={10} step={1} 
            onValueChange={val => setForm({...form, painScale: val[0]})}
            className="py-4"
          />
          <div className="flex justify-between text-xs font-medium text-slate-400">
            <span>Sem dor (0)</span>
            <span>Dor insuportável (10)</span>
          </div>
        </div>

        <div className="pt-6 flex justify-end">
          <Button onClick={handleSave} className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Anamnese"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
