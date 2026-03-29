import { useState } from "react";
import { Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskCpf } from "@/lib/masks";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    password: "",
    clinicName: "",
    role: "profissional" as const,
  });

  const registerMutation = useRegister();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { data: { ...formData, email: formData.email || undefined, clinicName: formData.clinicName || undefined } as any },
      {
        onSuccess: (res: any) => {
          toast({ title: "Conta criada!", description: "Bem-vindo ao FisioGest Pro." });
          login(res.token, res.user, res.clinics);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Erro no cadastro",
            description: err?.message || "Verifique os dados e tente novamente.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50">
      <div className="w-full flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 sm:p-10 border border-slate-100">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-primary p-2 rounded-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <span className="font-display font-bold text-2xl">FisioGest Pro</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground mb-2">Criar Conta</h2>
            <p className="text-muted-foreground">Preencha os dados abaixo para iniciar sua gestão clínica.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Nome da Clínica *</Label>
              <Input
                id="clinicName"
                placeholder="Ex: Clínica Fisio São Paulo"
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                required
                autoComplete="organization"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                placeholder="Dr. João Silva"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="name"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
                maxLength={14}
                required
                autoComplete="off"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                E-mail{" "}
                <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="email"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso</Label>
              <Select
                value={formData.role}
                onValueChange={(val: any) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">Profissional (Fisio/Estética)</SelectItem>
                  <SelectItem value="recepcionista">Recepcionista</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all mt-4"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : "Criar Conta"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-primary font-medium inline-flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para o Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
