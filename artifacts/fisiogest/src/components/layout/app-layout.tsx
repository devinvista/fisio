import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/use-auth";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Activity,
  Wallet,
  BarChart3,
  LogOut,
  Menu,
  Stethoscope,
  Building2,
  Settings2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ClinicSwitcher } from "@/components/layout/clinic-switcher";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Permission, Role } from "@/lib/permissions";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission | null;
  anyPermission?: Permission[];
  hideSuperAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, permission: "appointments.read" },
  { href: "/pacientes", label: "Pacientes", icon: Users, permission: "patients.read" },
  { href: "/procedimentos", label: "Procedimentos", icon: Activity, permission: "procedures.manage" },
  { href: "/pacotes", label: "Pacotes", icon: Package, permission: "procedures.manage" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, permission: "financial.read" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports.read" },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings2,
    permission: null,
    anyPermission: ["settings.manage", "users.manage"],
  },
  { href: "/clinicas", label: "Clínicas", icon: Building2, permission: "clinics.manage" },
];

interface SidebarContentProps {
  user: { name?: string; roles?: string[] } | null;
  logout: () => void;
  hasPermission: (p: Permission) => boolean;
  clinics: unknown[];
  isSuperAdmin: boolean;
  location: string;
}

function SidebarContent({ user, logout, hasPermission, clinics, isSuperAdmin, location }: SidebarContentProps) {
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    const hasAccess = item.anyPermission
      ? item.anyPermission.some((p) => hasPermission(p))
      : item.permission === null || hasPermission(item.permission);
    return hasAccess && !(item.hideSuperAdmin && isSuperAdmin);
  });

  const roleLabels = ((user as any)?.roles ?? [])
    .map((r: string) => ROLE_LABELS[r as Role] ?? r)
    .join(", ");

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 bg-black/10">
        <div className="bg-primary/20 p-2 rounded-lg">
          <Stethoscope className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">
          FisioGest <span className="text-primary-foreground/70">Pro</span>
        </span>
      </div>

      {(clinics.length > 1 || isSuperAdmin) && (
        <div className="px-4 pt-3 pb-1">
          <ClinicSwitcher />
        </div>
      )}

      <div className="flex-1 overflow-auto py-6 px-4">
        <nav className="space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 bg-black/10">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-10 w-10 rounded-full bg-primary/30 flex items-center justify-center font-bold text-white border border-primary/50">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">{user?.name}</span>
            <span className="text-xs text-sidebar-foreground/60 truncate">{roleLabels}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair do sistema
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { user, logout, hasPermission, clinics, isSuperAdmin } = useAuth();
  const [location] = useLocation();

  const sidebarProps: SidebarContentProps = {
    user,
    logout,
    hasPermission,
    clinics,
    isSuperAdmin,
    location,
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="hidden lg:block w-72 shrink-0 border-r border-sidebar-border shadow-2xl z-20">
        <SidebarContent {...sidebarProps} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden relative">
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-white/80 backdrop-blur-md px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-none">
                <SidebarContent {...sidebarProps} />
              </SheetContent>
            </Sheet>
            <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-full">
              <CalendarDays className="h-4 w-4" />
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
