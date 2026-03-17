import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import Agenda from "./pages/agenda";
import PatientsList from "./pages/patients/index";
import PatientDetail from "./pages/patients/[id]";
import Financial from "./pages/financial/index";
import Procedimentos from "./pages/procedimentos";
import Relatorios from "./pages/relatorios";
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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/agenda">
        {() => <ProtectedRoute component={Agenda} />}
      </Route>
      <Route path="/pacientes/:id">
        {() => <ProtectedRoute component={PatientDetail} />}
      </Route>
      <Route path="/pacientes">
        {() => <ProtectedRoute component={PatientsList} />}
      </Route>
      <Route path="/procedimentos">
        {() => <ProtectedRoute component={Procedimentos} />}
      </Route>
      <Route path="/financeiro">
        {() => <ProtectedRoute component={Financial} />}
      </Route>
      <Route path="/relatorios">
        {() => <ProtectedRoute component={Relatorios} />}
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
