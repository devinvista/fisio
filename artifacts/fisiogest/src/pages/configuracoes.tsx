import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Building2, Save, Phone, Mail, MapPin, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE.replace(/\/$/, "").replace(/\/[^/]+$/, "");

interface Clinic {
  id: number;
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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

async function fetchCurrentClinic(): Promise<Clinic> {
  const res = await fetch(`${API_BASE}/api/clinics/current`);
  if (!res.ok) throw new Error("Falha ao carregar dados da clínica");
  return res.json();
}

async function updateCurrentClinic(data: Partial<ClinicFormData>): Promise<Clinic> {
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

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ClinicFormData>({
    name: "",
    cnpj: "",
    phone: "",
    email: "",
    address: "",
  });

  const { data: clinic, isLoading } = useQuery<Clinic>({
    queryKey: ["clinic-current"],
    queryFn: fetchCurrentClinic,
  });

  useEffect(() => {
    if (clinic) {
      setFormData({
        name: clinic.name ?? "",
        cnpj: clinic.cnpj ?? "",
        phone: clinic.phone ?? "",
        email: clinic.email ?? "",
        address: clinic.address ?? "",
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <AppLayout title="Minha Clínica">
      <div className="max-w-2xl space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">
            Gerencie as informações da sua clínica. Estas informações podem aparecer em documentos e
            relatórios gerados pelo sistema.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Informações Gerais
                </CardTitle>
                <CardDescription>
                  Dados principais da clínica para identificação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Clínica *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Clínica FisioGest"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData((p) => ({ ...p, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contato</CardTitle>
                <CardDescription>
                  Informações de contato da clínica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Telefone
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicEmail" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> E-mail
                    </Label>
                    <Input
                      id="clinicEmail"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="contato@clinica.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Endereço
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade - Estado"
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2 min-w-32">
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
        )}
      </div>
    </AppLayout>
  );
}
