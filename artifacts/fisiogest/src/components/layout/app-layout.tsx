import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  CalendarDays,
  HeartHandshake,
  Dumbbell,
  Wallet,
  BarChart3,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LogoMark } from "@/components/logo-mark";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

const NAV_ITEMS = [
  { href: "/",             label: "Dashboard",      icon: LayoutDashboard },
  { href: "/agenda",       label: "Agenda",          icon: CalendarDays },
  { href: "/pacientes",    label: "Pacientes",       icon: HeartHandshake },
  { href: "/procedimentos",label: "Procedimentos",   icon: Dumbbell },
  { href: "/financeiro",   label: "Financeiro",      icon: Wallet },
  { href: "/relatorios",   label: "Relatórios",      icon: BarChart3 },
];

export function AppLayout({ children, title }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">

      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-white/8">
        <LogoMark size={36} className="shrink-0" />
        <div className="flex flex-col leading-none">
          <span className="font-display font-bold text-[17px] tracking-tight text-white">
            FisioGest
          </span>
          <span className="text-[11px] font-semibold tracking-widest text-primary uppercase opacity-80">
            Pro
          </span>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-6 pb-1">
        <p className="text-[10px] font-bold tracking-widest uppercase text-sidebar-foreground/35">
          Menu Principal
        </p>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-auto py-2 px-3">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150
                  ${isActive
                    ? "bg-primary/90 text-white shadow-md shadow-primary/30"
                    : "text-sidebar-foreground/60 hover:bg-white/6 hover:text-sidebar-foreground"
                  }
                `}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "opacity-70"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-white/8">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="h-9 w-9 rounded-full bg-primary/25 flex items-center justify-center font-bold text-white text-sm border border-primary/40 shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-white truncate">{user?.name}</span>
            <span className="text-[11px] text-sidebar-foreground/50 capitalize">{user?.role}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/50 hover:bg-white/6 hover:text-sidebar-foreground text-[13px]"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair do sistema
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border/40 shadow-2xl z-20">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white/85 backdrop-blur-md px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 border-none">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-400 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
