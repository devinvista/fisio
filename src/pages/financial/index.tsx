import { AppLayout } from "@/components/layout/app-layout";
import { useGetFinancialDashboard, useListFinancialRecords, useCreateFinancialRecord } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Financial() {
  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useGetFinancialDashboard();
  const { data: records, isLoading: recLoading, refetch: refetchRec } = useListFinancialRecords();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <AppLayout title="Controle Financeiro">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-md hover:shadow-lg transition-all bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-green-100 text-green-600 rounded-2xl">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Receitas</p>
                <h3 className="font-display text-3xl font-bold text-slate-800 mt-1">
                  {dashLoading ? "..." : formatCurrency(dashboard?.monthlyRevenue || 0)}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md hover:shadow-lg transition-all bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-red-100 text-red-600 rounded-2xl">
                <TrendingDown className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Despesas</p>
                <h3 className="font-display text-3xl font-bold text-slate-800 mt-1">
                  {dashLoading ? "..." : formatCurrency(dashboard?.monthlyExpenses || 0)}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md hover:shadow-lg transition-all bg-primary text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider">Lucro Líquido</p>
                <h3 className="font-display text-3xl font-bold text-white mt-1">
                  {dashLoading ? "..." : formatCurrency(dashboard?.monthlyProfit || 0)}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl font-bold">Lançamentos Recentes</h2>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20 h-11 px-6">
              <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="border-none shadow-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Adicionar Registro</DialogTitle>
            </DialogHeader>
            <CreateRecordForm onSuccess={() => { setIsModalOpen(false); refetchDash(); refetchRec(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        {recLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 font-semibold text-slate-500 uppercase text-xs tracking-wider">Data</th>
                  <th className="py-4 px-6 font-semibold text-slate-500 uppercase text-xs tracking-wider">Descrição</th>
                  <th className="py-4 px-6 font-semibold text-slate-500 uppercase text-xs tracking-wider">Categoria</th>
                  <th className="py-4 px-6 font-semibold text-slate-500 uppercase text-xs tracking-wider">Tipo</th>
                  <th className="py-4 px-6 font-semibold text-slate-500 uppercase text-xs tracking-wider text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records?.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-600">{format(new Date(record.createdAt), "dd/MM/yyyy")}</td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-800">{record.description}</td>
                    <td className="py-4 px-6 text-sm text-slate-500">{record.category || "-"}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        record.type === 'receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {record.type === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className={`py-4 px-6 text-sm font-bold text-right ${record.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                      {record.type === 'despesa' ? '-' : '+'} {formatCurrency(record.amount)}
                    </td>
                  </tr>
                ))}
                {!records?.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">Nenhum registro encontrado no período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}

function CreateRecordForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({ type: "despesa" as const, amount: "", description: "", category: "" });
  const mutation = useCreateFinancialRecord();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      data: { ...formData, amount: Number(formData.amount) }
    }, {
      onSuccess: () => {
        toast({ title: "Registrado", description: "Lançamento salvo com sucesso." });
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v as any})}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesa (Saída)</SelectItem>
              <SelectItem value="receita">Receita (Entrada Avulsa)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="h-12 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="h-12 rounded-xl" placeholder="Ex: Conta de Luz" />
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="h-12 rounded-xl" placeholder="Ex: Custos Fixos" />
      </div>
      <Button type="submit" className="w-full h-12 rounded-xl shadow-lg mt-4" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : "Salvar Lançamento"}
      </Button>
    </form>
  );
}
