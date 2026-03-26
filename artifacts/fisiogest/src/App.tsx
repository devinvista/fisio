import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import type { Permission } from "@/lib/permissions";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import Agenda from "./pages/agenda";
import PatientsList from "./pages/patients/index";
import PatientDetail from "./pages/patients/[id]";
import Financial from "./pages/financial/index";
import Procedimentos from "./pages/procedimentos";
import Relatorios from "./pages/relatorios";
import Clinicas from "./pages/clinicas";
import Configuracoes from "./pages/configuracoes";
import Agendar from "./pages/agendar";
import NotFound from "./pages/not-found";

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem("fisiogest_token");
  if (token) {
    init = init || {};
    if (init.headers instanceof Headers) {
      if (!init.headers.has("authorization")) {
        init.headers.set("Authorization", `Bearer ${token}`);
      }
    } else {
      init.headers = { Authorization: `Bearer ${token}`, ...init.headers };
    }
  }
  return originalFetch(input, init);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function HashRedirect({ hash }: { hash: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/configuracoes`);
    window.location.hash = hash;
  }, [hash, setLocation]);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [token, isLoading, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Carregando...</div>;
  if (!token) return null;

  return <Component />;
}

function PermissionRoute({
  component: Component,
  permission,
}: {
  component: React.ComponentType;
  permission: Permission;
}) {
  const { token, isLoading, hasPermission } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [token, isLoading, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Carregando...</div>;
  if (!token) return null;

  if (!hasPermission(permission)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/agenda">
        {() => <PermissionRoute component={Agenda} permission="appointments.read" />}
      </Route>
      <Route path="/pacientes/:id">
        {() => <PermissionRoute component={PatientDetail} permission="patients.read" />}
      </Route>
      <Route path="/pacientes">
        {() => <PermissionRoute component={PatientsList} permission="patients.read" />}
      </Route>
      <Route path="/procedimentos">
        {() => <PermissionRoute component={Procedimentos} permission="procedures.manage" />}
      </Route>
      <Route path="/financeiro">
        {() => <PermissionRoute component={Financial} permission="financial.read" />}
      </Route>
      <Route path="/relatorios">
        {() => <PermissionRoute component={Relatorios} permission="reports.read" />}
      </Route>
      <Route path="/usuarios">
        {() => <HashRedirect hash="usuarios" />}
      </Route>
      <Route path="/configuracoes">
        {() => <ProtectedRoute component={Configuracoes} />}
      </Route>
      <Route path="/agendas">
        {() => <HashRedirect hash="agendas" />}
      </Route>
      <Route path="/clinicas">
        {() => <PermissionRoute component={Clinicas} permission="clinics.manage" />}
      </Route>
      <Route path="/agendar" component={Agendar} />
      <Route path="/agendar/:token" component={Agendar} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
