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
import Usuarios from "./pages/usuarios";
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
        {() => <PermissionRoute component={Usuarios} permission="users.manage" />}
      </Route>
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
