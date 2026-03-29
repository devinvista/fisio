import { FadeIn } from "./utils";
import {
  CalendarX,
  UserMinus,
  TrendingDown,
  Clock,
  FolderX,
} from "lucide-react";

const PROBLEMS = [
  {
    icon: CalendarX,
    title: "Agenda desorganizada",
    description:
      "Conflitos de horários, esquecimentos e double booking que prejudicam seus pacientes e geram retrabalho.",
    color: "text-red-500",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  {
    icon: UserMinus,
    title: "Perda de pacientes",
    description:
      "Sem lembretes automáticos e follow-up estruturado, pacientes somem e a carteira encolhe.",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
  {
    icon: TrendingDown,
    title: "Falta de controle financeiro",
    description:
      "Sem visibilidade de receitas e despesas, fica impossível saber se a clínica está dando lucro.",
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    icon: Clock,
    title: "Tempo perdido",
    description:
      "Planilhas, WhatsApp e papel consomem horas preciosas que poderiam ser usadas com pacientes.",
    color: "text-rose-500",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
  {
    icon: FolderX,
    title: "Desorganização da clínica",
    description:
      "Prontuários físicos espalhados, dados duplicados e informações impossíveis de encontrar rapidamente.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
  },
];

export function ProblemsSection() {
  return (
    <section
      id="problemas"
      aria-labelledby="problems-heading"
      className="py-24 lg:py-32 bg-slate-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <CalendarX className="w-3.5 h-3.5" aria-hidden="true" />
            Problemas que você conhece bem
          </div>
          <h2
            id="problems-heading"
            className="font-display font-bold text-slate-900 text-4xl lg:text-5xl mb-4"
          >
            Sua clínica merece mais
            <br className="hidden sm:block" /> do que isso
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Esses obstáculos são comuns, mas não precisam ser permanentes. Cada
            dia sem um sistema adequado custa tempo e dinheiro.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROBLEMS.map((problem, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div
                className={`h-full p-6 rounded-2xl border ${problem.border} bg-white hover:shadow-lg transition-all duration-300 group`}
              >
                <div
                  className={`w-12 h-12 rounded-xl ${problem.bg} flex items-center justify-center mb-4`}
                  aria-hidden="true"
                >
                  <problem.icon className={`w-6 h-6 ${problem.color}`} />
                </div>
                <h3 className="font-display font-bold text-slate-900 text-lg mb-2">
                  {problem.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </FadeIn>
          ))}

          <FadeIn delay={0.4} className="sm:col-span-2 lg:col-span-0 lg:col-start-3">
            <div className="h-full p-6 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col justify-center items-center text-center">
              <p className="font-display font-bold text-teal-700 text-xl mb-2">
                Existe uma solução melhor
              </p>
              <p className="text-teal-600/70 text-sm">
                FisioGest Pro foi criado especificamente para resolver cada um desses problemas.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
