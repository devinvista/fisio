import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useListPatients, useCreatePatient } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, UserPlus, Phone, Mail, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PatientsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useListPatients({ search, limit: 50 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <AppLayout title="Pacientes">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-8">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Buscar por nome ou CPF..." 
            className="pl-10 h-12 rounded-xl bg-white shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Novo Paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <CreatePatientForm onSuccess={() => {
              setIsDialogOpen(false);
              refetch();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.data.map(patient => (
            <Link key={patient.id} href={`/pacientes/${patient.id}`}>
              <Card className="cursor-pointer group hover:shadow-xl hover:border-primary/30 transition-all duration-300 h-full border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground line-clamp-1">{patient.name}</h3>
                        <p className="text-sm text-muted-foreground">CPF: {patient.cpf}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-6">
                    <div className="flex items-center text-sm text-slate-600 gap-3">
                      <div className="p-1.5 bg-slate-100 rounded-md"><Phone className="w-4 h-4 text-slate-500" /></div>
                      {patient.phone}
                    </div>
                    {patient.email && (
                      <div className="flex items-center text-sm text-slate-600 gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-md"><Mail className="w-4 h-4 text-slate-500" /></div>
                        <span className="line-clamp-1">{patient.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <span className="text-primary text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform">
                      Ver prontuário <ChevronRight className="w-4 h-4 ml-1" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center shadow-sm">
          <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserPlus className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-display font-bold text-slate-800 mb-2">Nenhum paciente encontrado</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            {search ? "Tente ajustar os termos da sua busca." : "Comece cadastrando seu primeiro paciente para gerenciar prontuários e agendamentos."}
          </p>
          {!search && (
            <Button onClick={() => setIsDialogOpen(true)} className="h-12 px-8 rounded-xl">
              Cadastrar Primeiro Paciente
            </Button>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function CreatePatientForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: "", cpf: "", phone: "", email: "", birthDate: "" });
  const mutation = useCreatePatient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Paciente cadastrado com sucesso!" });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro", description: "Falha ao cadastrar paciente." });
      }
    });
  };

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="font-display text-2xl">Novo Paciente</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nome Completo *</Label>
          <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-11" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input required value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-11" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <Input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="h-11" />
          </div>
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
