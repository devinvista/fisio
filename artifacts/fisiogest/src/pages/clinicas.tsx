import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Building2, Plus, Pencil, Trash2, Users, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE.replace(/\/$/, "").replace(/\/[^/]+$/, "");

async function fetchClinics() {
  const res = await fetch(`${API_BASE}/api/clinics`);
  if (!res.ok) throw new Error("Failed to fetch clinics");
  return res.json();
}

async function createClinic(data: Record<string, string>) {
  const res = await fetch(`${API_BASE}/api/clinics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Erro ao criar clínica");
  }
  return res.json();
}

async function updateClinic(id: number, data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/clinics/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao atualizar clínica");
  return res.json();
}

async function deleteClinic(id: number) {
  const res = await fetch(`${API_BASE}/api/clinics/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir clínica");
}

interface Clinic {
  id: number;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

interface ClinicFormData {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_FORM: ClinicFormData = { name: "", cnpj: "", phone: "", email: "", address: "" };

export default function Clinicas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [deletingClinicId, setDeletingClinicId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ClinicFormData>(EMPTY_FORM);

  const { data: clinics = [], isLoading } = useQuery<Clinic[]>({
    queryKey: ["clinics"],
    queryFn: fetchClinics,
  });

  const createMutation = useMutation({
    mutationFn: createClinic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      toast({ title: "Clínica criada com sucesso!" });
      setIsCreateOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateClinic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      toast({ title: "Clínica atualizada!" });
      setEditingClinic(null);
      setFormData(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClinic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      toast({ title: "Clínica excluída." });
      setDeletingClinicId(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao excluir clínica" });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: formData.name, cnpj: formData.cnpj, phone: formData.phone, email: formData.email, address: formData.address });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClinic) return;
    updateMutation.mutate({ id: editingClinic.id, data: { name: formData.name, cnpj: formData.cnpj, phone: formData.phone, email: formData.email, address: formData.address } });
  };

  const openEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormData({ name: clinic.name, cnpj: clinic.cnpj ?? "", phone: clinic.phone ?? "", email: clinic.email ?? "", address: clinic.address ?? "" });
  };

  const toggleActive = (clinic: Clinic) => {
    updateMutation.mutate({ id: clinic.id, data: { isActive: !clinic.isActive } });
  };

  return (
    <AppLayout title="Gestão de Clínicas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Todas as Clínicas</h2>
            <p className="text-sm text-muted-foreground">{clinics.length} clínica(s) cadastrada(s)</p>
          </div>
          <Button onClick={() => { setFormData(EMPTY_FORM); setIsCreateOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Clínica
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : clinics.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <Building2 className="h-16 w-16 text-muted-foreground/30" />
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Nenhuma clínica cadastrada</h3>
                <p className="text-muted-foreground text-sm">Crie a primeira clínica para começar.</p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Criar Clínica
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clinics.map((clinic) => (
              <Card key={clinic.id} className={`relative transition-all ${!clinic.isActive ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{clinic.name}</CardTitle>
                        {clinic.cnpj && <p className="text-xs text-muted-foreground mt-0.5">{clinic.cnpj}</p>}
                      </div>
                    </div>
                    <Badge variant={clinic.isActive ? "default" : "secondary"} className="shrink-0 text-xs">
                      {clinic.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(clinic.phone || clinic.email) && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {clinic.phone && <p>📞 {clinic.phone}</p>}
                      {clinic.email && <p>✉️ {clinic.email}</p>}
                      {clinic.address && <p>📍 {clinic.address}</p>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button size="sm" variant="ghost" className="flex-1 gap-1.5 text-xs" onClick={() => openEdit(clinic)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 gap-1.5 text-xs" onClick={() => toggleActive(clinic)}>
                      {clinic.isActive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                      {clinic.isActive ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingClinicId(clinic.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Clínica</DialogTitle>
            <DialogDescription>Preencha os dados da nova clínica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <ClinicForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Clínica"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingClinic} onOpenChange={(open) => !open && setEditingClinic(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Clínica</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <ClinicForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingClinic(null)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingClinicId} onOpenChange={(open) => !open && setDeletingClinicId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Clínica</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados associados a esta clínica serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingClinicId && deleteMutation.mutate(deletingClinicId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function ClinicForm({
  formData,
  setFormData,
}: {
  formData: { name: string; cnpj: string; phone: string; email: string; address: string };
  setFormData: (data: any) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="clinicName">Nome da Clínica *</Label>
        <Input
          id="clinicName"
          value={formData.name}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Clínica São Paulo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input
          id="cnpj"
          value={formData.cnpj}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, cnpj: e.target.value }))}
          placeholder="00.000.000/0001-00"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, phone: e.target.value }))}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clinicEmail">E-mail</Label>
          <Input
            id="clinicEmail"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, email: e.target.value }))}
            placeholder="contato@clinica.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, address: e.target.value }))}
          placeholder="Rua, número, bairro, cidade"
        />
      </div>
    </>
  );
}
