import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import LogoMark from "@/components/logo-mark";
import {
  Calendar,
  Users,
  BarChart3,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  ArrowRight,
  Star,
  TrendingUp,
  Clock,
  FileText,
  DollarSign,
  Activity,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Building2,
  HeartPulse,
  Award,
  Play,
} from "lucide-react";

/* ─── Animated Counter ──────────────────────────────────────────────────── */
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 1800, bounce: 0 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) motionVal.set(value);
  }, [inView, value, motionVal]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return (
    <span ref={ref}>
      {prefix}{display.toLocaleString("pt-BR")}{suffix}
    </span>
  );
}

/* ─── Fade-in on scroll ─────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "", direction = "up" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const dirMap = { up: { y: 40, x: 0 }, left: { y: 0, x: -40 }, right: { y: 0, x: 40 }, none: { y: 0, x: 0 } };
  const { x, y } = dirMap[direction];
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Mini Dashboard Mockup ─────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Glow rings */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-teal-500/20 via-transparent to-cyan-400/10 blur-2xl pointer-events-none" />
      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-[#0f1a2e]">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0a1220] border-b border-white/5">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <div className="ml-4 flex-1 bg-white/5 rounded-md px-3 py-1 text-xs text-white/30 flex items-center gap-2">
            <Shield className="w-3 h-3" />
            app.fisiogestpro.com.br/dashboard
          </div>
        </div>
        {/* App content */}
        <div className="flex h-80">
          {/* Sidebar */}
          <div className="w-16 bg-[#07111e] flex flex-col items-center py-4 gap-4 border-r border-white/5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            {[Calendar, Users, DollarSign, BarChart3, FileText].map((Icon, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? "bg-teal-600/30 ring-1 ring-teal-500/50" : "hover:bg-white/5"}`}>
                <Icon className={`w-4 h-4 ${i === 0 ? "text-teal-300" : "text-white/25"}`} />
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 p-4 overflow-hidden">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "Receita", value: "R$ 12.450", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Pacientes", value: "142", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Hoje", value: "8 atend.", icon: Calendar, color: "text-teal-400", bg: "bg-teal-500/10" },
              ].map((k, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <div className={`w-5 h-5 rounded-md ${k.bg} flex items-center justify-center mb-1.5`}>
                    <k.icon className={`w-3 h-3 ${k.color}`} />
                  </div>
                  <div className="text-white text-xs font-bold">{k.value}</div>
                  <div className="text-white/30 text-[9px]">{k.label}</div>
                </div>
              ))}
            </div>
            {/* Appointment list */}
            <div className="space-y-1.5">
              <div className="text-white/30 text-[10px] mb-2 font-medium uppercase tracking-widest">Agenda de hoje</div>
              {[
                { name: "Maria S.", time: "08:00", status: "done", procedure: "Fisioterapia" },
                { name: "João P.", time: "09:30", status: "current", procedure: "Pilates" },
                { name: "Ana C.", time: "11:00", status: "next", procedure: "Drenagem" },
                { name: "Carlos M.", time: "14:00", status: "pending", procedure: "Acupuntura" },
              ].map((appt, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${i === 1 ? "bg-teal-500/10 border-teal-500/30" : "bg-white/3 border-white/5"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-emerald-400" : i === 1 ? "bg-teal-400 animate-pulse" : i === 2 ? "bg-blue-400" : "bg-white/20"}`} />
                  <span className="text-[10px] text-white/40 w-8 shrink-0">{appt.time}</span>
                  <span className="text-[10px] text-white/70 flex-1 truncate">{appt.name}</span>
                  <span className="text-[9px] text-white/30 truncate">{appt.procedure}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Right panel */}
          <div className="w-36 bg-[#07111e] border-l border-white/5 p-3 hidden xl:block">
            <div className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Ocupação</div>
            <div className="relative w-full aspect-square flex items-center justify-center mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#14b8a6" strokeWidth="3"
                  strokeDasharray="72 100" strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <div className="text-teal-300 font-bold text-sm">72%</div>
                <div className="text-white/25 text-[8px]">taxa</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {["Fis.", "Pilates", "Estética"].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" style={{ width: `${[80, 60, 45][i]}%` }} />
                  </div>
                  <span className="text-[9px] text-white/25">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Feature Card ───────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, delay = 0, accent = "teal" }: {
  icon: React.ElementType; title: string; description: string; delay?: number; accent?: string;
}) {
  const colors: Record<string, string> = {
    teal: "bg-teal-500/10 text-teal-600 group-hover:bg-teal-500/20",
    blue: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-600 group-hover:bg-violet-500/20",
    amber: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20",
    rose: "bg-rose-500/10 text-rose-600 group-hover:bg-rose-500/20",
  };
  return (
    <FadeIn delay={delay} className="group">
      <div className="h-full p-6 rounded-2xl border border-slate-200/60 bg-white hover:border-teal-200 hover:shadow-xl hover:shadow-teal-500/5 transition-all duration-300 cursor-default">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300 ${colors[accent] ?? colors.teal}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-display font-bold text-slate-900 text-lg mb-2">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
      </div>
    </FadeIn>
  );
}

/* ─── Pricing Card ───────────────────────────────────────────────────────── */
function PricingCard({ plan, price, period = "/mês", features, cta, highlighted = false, badge = "" }: {
  plan: string; price: string; period?: string; features: string[]; cta: string; highlighted?: boolean; badge?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className={`relative flex flex-col rounded-2xl p-8 border transition-all duration-300 ${
      highlighted
        ? "bg-[#0a1628] border-teal-500/40 shadow-2xl shadow-teal-500/20 scale-105"
        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg"
    }`}>
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-teal-500/30">
          {badge}
        </div>
      )}
      <div className={`text-sm font-semibold mb-4 ${highlighted ? "text-teal-400" : "text-teal-600"}`}>{plan}</div>
      <div className="mb-6">
        <span className={`font-display text-5xl font-bold ${highlighted ? "text-white" : "text-slate-900"}`}>{price}</span>
        <span className={`text-sm ml-1 ${highlighted ? "text-white/40" : "text-slate-400"}`}>{period}</span>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${highlighted ? "text-teal-400" : "text-teal-500"}`} />
            <span className={highlighted ? "text-white/70" : "text-slate-600"}>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setLocation("/register")}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
          highlighted
            ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-teal-500/40 hover:-translate-y-0.5"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

/* ─── Main Landing Page ─────────────────────────────────────────────────── */
export default function LandingPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* Auto-redirect authenticated users */
  useEffect(() => {
    if (token) setLocation("/dashboard");
  }, [token, setLocation]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (token) return null;

  const navLinks = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Preços", href: "#precos" },
    { label: "Depoimentos", href: "#depoimentos" },
  ];

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <span className={`font-display font-bold text-xl transition-colors ${scrolled ? "text-slate-900" : "text-white"}`}>
              FisioGest <span className="text-teal-400">Pro</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollTo(l.href)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  scrolled ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className={`text-sm font-medium transition-colors ${scrolled ? "text-slate-600 hover:text-slate-900" : "text-white/80 hover:text-white"}`}>
              Entrar
            </Link>
            <Link
              href="/register"
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5 transition-all duration-200"
            >
              Começar Grátis
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? "text-slate-600" : "text-white"}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden bg-white border-b border-slate-200 px-4 pb-4"
            >
              {navLinks.map((l) => (
                <button
                  key={l.label}
                  onClick={() => scrollTo(l.href)}
                  className="block w-full text-left px-3 py-3 text-slate-700 text-sm font-medium hover:text-teal-600 border-b border-slate-100 last:border-0"
                >
                  {l.label}
                </button>
              ))}
              <div className="flex gap-3 mt-4">
                <Link href="/login" className="flex-1 text-center py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl">Entrar</Link>
                <Link href="/register" className="flex-1 text-center py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl">Começar Grátis</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center bg-[#060f1e] overflow-hidden">
        {/* Animated mesh background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-600/5 rounded-full blur-3xl" />
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-32 lg:py-0 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 min-h-screen lg:pt-16">
            {/* Left — Text */}
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-8"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sistema completo para sua clínica
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="font-display font-bold text-white text-5xl sm:text-6xl lg:text-7xl leading-[1.08] tracking-tight mb-6"
              >
                Gerencie sua{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">clínica</span>
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-teal-400/60 to-cyan-300/60" />
                </span>
                {" "}com precisão cirúrgica.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="text-white/55 text-xl leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0"
              >
                FisioGest Pro é o sistema completo para fisioterapia, estética e pilates.
                Agenda, prontuários, financeiro e relatórios — tudo integrado.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold px-8 py-4 rounded-2xl text-base shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-1 transition-all duration-200"
                >
                  Começar Gratuitamente
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => scrollTo("#como-funciona")}
                  className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base backdrop-blur-sm transition-all duration-200"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Ver como funciona
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.75 }}
                className="mt-10 flex items-center gap-6 justify-center lg:justify-start"
              >
                <div className="flex -space-x-2">
                  {["MT", "JP", "AS", "CR", "LF"].map((initials, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 border-2 border-[#060f1e] flex items-center justify-center text-[9px] font-bold text-white">
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-white/40 text-xs">+500 clínicas confiam no FisioGest Pro</p>
                </div>
              </motion.div>
            </div>

            {/* Right — Dashboard Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 w-full max-w-2xl lg:max-w-none"
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20"
        >
          <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent mx-auto mb-2" />
          <ChevronRight className="w-4 h-4 rotate-90" />
        </motion.div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-teal-600 to-cyan-600 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-white text-center">
            {[
              { value: 500, suffix: "+", label: "Clínicas ativas" },
              { value: 50000, suffix: "+", label: "Pacientes cadastrados" },
              { value: 1200000, suffix: "+", label: "Atendimentos registrados" },
              { value: 99, suffix: "%", label: "Satisfação dos clientes" },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div>
                  <div className="font-display font-bold text-4xl lg:text-5xl mb-1">
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-white/70 text-sm font-medium">{s.label}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <Zap className="w-3.5 h-3.5" />
              Tudo que você precisa
            </div>
            <h2 className="font-display font-bold text-slate-900 text-4xl lg:text-5xl mb-4">
              Funcionalidades que fazem
              <br className="hidden sm:block" /> a diferença no dia a dia
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Cada recurso foi pensado especificamente para a realidade de clínicas de fisioterapia, estética e pilates.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Calendar,
                title: "Agenda Inteligente",
                description: "Visualização semanal e diária, confirmações automáticas por WhatsApp, controle de disponibilidade e gestão de horários por terapeuta.",
                accent: "teal",
              },
              {
                icon: FileText,
                title: "Prontuários Digitais",
                description: "Histórico clínico completo, evolução por sessão, anamnese estruturada, anexo de documentos e imagens de avaliação.",
                accent: "blue",
              },
              {
                icon: DollarSign,
                title: "Controle Financeiro",
                description: "Registro de receitas e despesas, relatórios por período, gestão de inadimplência e fluxo de caixa em tempo real.",
                accent: "emerald",
              },
              {
                icon: BarChart3,
                title: "Relatórios Avançados",
                description: "KPIs automáticos de ocupação, receita por procedimento, análise de retenção de pacientes e desempenho da equipe.",
                accent: "violet",
              },
              {
                icon: Building2,
                title: "Multi-Clínica",
                description: "Gerencie múltiplas unidades em um único painel. Controle de acesso por perfil, financeiro separado por clínica.",
                accent: "amber",
              },
              {
                icon: Globe,
                title: "Agendamento Online",
                description: "Página de agendamento público para seus pacientes, sem precisar de ligação — com confirmação automática.",
                accent: "rose",
              },
            ].map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <Activity className="w-3.5 h-3.5" />
              Em 3 passos simples
            </div>
            <h2 className="font-display font-bold text-slate-900 text-4xl lg:text-5xl mb-4">
              Comece em minutos,
              <br className="hidden sm:block" /> não em semanas
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Sem instalação, sem complicação. FisioGest Pro funciona direto no navegador.
            </p>
          </FadeIn>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-16 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
              {[
                {
                  step: "01",
                  icon: HeartPulse,
                  title: "Crie sua conta",
                  description: "Cadastre-se gratuitamente em menos de 2 minutos. Sem cartão de crédito, sem burocracia. Acesso imediato.",
                },
                {
                  step: "02",
                  icon: Users,
                  title: "Cadastre pacientes",
                  description: "Importe seus pacientes ou cadastre manualmente. Adicione histórico, procedimentos e informações clínicas.",
                },
                {
                  step: "03",
                  icon: TrendingUp,
                  title: "Gerencie com confiança",
                  description: "Agenda, financeiro, relatórios — tudo em um painel. Sua clínica mais organizada a partir do primeiro dia.",
                },
              ].map((s, i) => (
                <FadeIn key={i} delay={i * 0.15} className="relative">
                  <div className="text-center px-4">
                    <div className="relative inline-flex mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 flex items-center justify-center shadow-lg shadow-teal-500/10">
                        <s.icon className="w-7 h-7 text-teal-600" />
                      </div>
                      <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                        {s.step.slice(-1)}
                      </div>
                    </div>
                    <h3 className="font-display font-bold text-slate-900 text-xl mb-3">{s.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{s.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          <FadeIn delay={0.3} className="text-center mt-14">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-semibold px-8 py-4 rounded-2xl text-base shadow-xl shadow-teal-500/25 hover:-translate-y-0.5 transition-all duration-200"
            >
              Criar minha conta grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-slate-400 text-sm mt-3">Sem cartão de crédito · Cancele quando quiser</p>
          </FadeIn>
        </div>
      </section>

      {/* ── Dark Feature Showcase ────────────────────────────────────────── */}
      <section className="bg-[#060f1e] py-24 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <FadeIn direction="left" className="flex-1">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Award className="w-3.5 h-3.5" />
                Desenvolvido por especialistas
              </div>
              <h2 className="font-display font-bold text-white text-4xl lg:text-5xl mb-6 leading-tight">
                Seu sistema,
                <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent"> sempre disponível</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Acesse FisioGest Pro de qualquer dispositivo, em qualquer lugar. Dados seguros em nuvem, com backup automático e 99.9% de disponibilidade.
              </p>
              <ul className="space-y-4">
                {[
                  "Acesso via computador, tablet ou celular",
                  "Dados criptografados e em conformidade com a LGPD",
                  "Backup automático diário na nuvem",
                  "Suporte técnico por chat e e-mail",
                  "Atualizações automáticas sem custo adicional",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70 text-sm">
                    <div className="w-5 h-5 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3 h-3 text-teal-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn direction="right" delay={0.2} className="flex-1 w-full">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Shield, label: "Segurança", value: "LGPD", desc: "em conformidade" },
                  { icon: Clock, label: "Uptime", value: "99.9%", desc: "disponibilidade" },
                  { icon: Zap, label: "Velocidade", value: "<100ms", desc: "tempo de resposta" },
                  { icon: HeartPulse, label: "Suporte", value: "24/7", desc: "atendimento" },
                ].map((card, i) => (
                  <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center mb-4">
                      <card.icon className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="font-display font-bold text-white text-2xl">{card.value}</div>
                    <div className="text-white/35 text-xs mt-0.5">{card.desc}</div>
                    <div className="text-teal-400/70 text-xs font-medium mt-2">{card.label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="precos" className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <DollarSign className="w-3.5 h-3.5" />
              Planos e preços
            </div>
            <h2 className="font-display font-bold text-slate-900 text-4xl lg:text-5xl mb-4">
              Investimento que cabe
              <br className="hidden sm:block" /> no orçamento da sua clínica
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Comece grátis por 14 dias. Sem cartão de crédito. Cancele quando quiser.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-4 items-start">
            <FadeIn delay={0}>
              <PricingCard
                plan="Essencial"
                price="R$ 89"
                features={[
                  "1 fisioterapeuta",
                  "Até 100 pacientes",
                  "Agenda completa",
                  "Prontuários digitais",
                  "Controle financeiro básico",
                  "Suporte por e-mail",
                ]}
                cta="Começar grátis"
              />
            </FadeIn>
            <FadeIn delay={0.1}>
              <PricingCard
                plan="Profissional"
                price="R$ 179"
                features={[
                  "Até 3 fisioterapeutas",
                  "Pacientes ilimitados",
                  "Tudo do plano Essencial",
                  "Relatórios avançados",
                  "Agendamento online",
                  "Suporte prioritário",
                  "Multi-procedimentos",
                ]}
                cta="Começar grátis"
                highlighted
                badge="Mais popular"
              />
            </FadeIn>
            <FadeIn delay={0.2}>
              <PricingCard
                plan="Clínica"
                price="R$ 349"
                features={[
                  "Fisioterapeutas ilimitados",
                  "Pacientes ilimitados",
                  "Multi-clínica",
                  "Controle de acesso avançado",
                  "API e integrações",
                  "Gerente de conta dedicado",
                  "Treinamento personalizado",
                ]}
                cta="Falar com vendas"
              />
            </FadeIn>
          </div>

          <FadeIn delay={0.3} className="text-center mt-10">
            <p className="text-slate-400 text-sm">
              Precisa de algo personalizado?{" "}
              <a href="mailto:contato@fisiogestpro.com.br" className="text-teal-600 font-medium hover:underline">
                Entre em contato
              </a>
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section id="depoimentos" className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              O que dizem nossos clientes
            </div>
            <h2 className="font-display font-bold text-slate-900 text-4xl lg:text-5xl mb-4">
              Clínicas reais,
              <br className="hidden sm:block" /> resultados reais
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "Antes usávamos planilhas para tudo. O FisioGest Pro transformou completamente nossa rotina. Em uma semana já estávamos rodando com 100% da equipe.",
                name: "Dra. Marina Tavares",
                role: "Fisioterapeuta · São Paulo, SP",
                stars: 5,
                initials: "MT",
              },
              {
                quote: "A agenda integrada com o financeiro é incrível. Conseguimos aumentar nossa taxa de ocupação em 28% no primeiro trimestre de uso.",
                name: "João Pedro Alves",
                role: "Gestor · Clínica Revitaliza · RJ",
                stars: 5,
                initials: "JP",
              },
              {
                quote: "O suporte é excepcional. Qualquer dúvida, eles respondem rápido. O sistema é intuitivo e meus colaboradores aprenderam em menos de um dia.",
                name: "Adriana Sousa",
                role: "Proprietária · Studio Pilates BH",
                stars: 5,
                initials: "AS",
              },
            ].map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="h-full p-7 rounded-2xl border border-slate-200 bg-white hover:border-teal-100 hover:shadow-xl hover:shadow-teal-500/5 transition-all duration-300">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-slate-900 font-semibold text-sm">{t.name}</div>
                      <div className="text-slate-400 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="relative bg-[#060f1e] py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              14 dias grátis · Sem cartão de crédito
            </div>
            <h2 className="font-display font-bold text-white text-4xl lg:text-6xl mb-6 leading-tight">
              Sua clínica merece
              <br /> uma gestão{" "}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">profissional.</span>
            </h2>
            <p className="text-white/50 text-lg mb-12 max-w-xl mx-auto">
              Junte-se a mais de 500 clínicas que já transformaram sua gestão com FisioGest Pro. Comece hoje mesmo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold px-10 py-4 rounded-2xl text-base shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-1 transition-all duration-200"
              >
                Começar Gratuitamente
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold px-10 py-4 rounded-2xl text-base backdrop-blur-sm transition-all"
              >
                Já tenho uma conta
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#040c19] py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-7 h-7" />
              <span className="font-display font-bold text-white text-lg">
                FisioGest <span className="text-teal-400">Pro</span>
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/30">
              <button onClick={() => scrollTo("#funcionalidades")} className="hover:text-white/60 transition-colors">Funcionalidades</button>
              <button onClick={() => scrollTo("#precos")} className="hover:text-white/60 transition-colors">Preços</button>
              <Link href="/login" className="hover:text-white/60 transition-colors">Entrar</Link>
              <Link href="/register" className="hover:text-white/60 transition-colors">Cadastrar</Link>
              <a href="mailto:contato@fisiogestpro.com.br" className="hover:text-white/60 transition-colors">Contato</a>
            </div>
            <p className="text-white/20 text-xs text-center md:text-right">
              © {new Date().getFullYear()} FisioGest Pro. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
