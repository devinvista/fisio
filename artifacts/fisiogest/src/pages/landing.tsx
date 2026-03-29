import { lazy, Suspense, useEffect } from "react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";

const ProblemsSection = lazy(() =>
  import("@/components/landing/ProblemsSection").then((m) => ({ default: m.ProblemsSection }))
);
const SolutionSection = lazy(() =>
  import("@/components/landing/SolutionSection").then((m) => ({ default: m.SolutionSection }))
);
const FeaturesSection = lazy(() =>
  import("@/components/landing/FeaturesSection").then((m) => ({ default: m.FeaturesSection }))
);
const BenefitsSection = lazy(() =>
  import("@/components/landing/BenefitsSection").then((m) => ({ default: m.BenefitsSection }))
);
const PricingSection = lazy(() =>
  import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection }))
);
const TestimonialsSection = lazy(() =>
  import("@/components/landing/TestimonialsSection").then((m) => ({ default: m.TestimonialsSection }))
);
const FAQSection = lazy(() =>
  import("@/components/landing/FAQSection").then((m) => ({ default: m.FAQSection }))
);
const CTASection = lazy(() =>
  import("@/components/landing/CTASection").then((m) => ({ default: m.CTASection }))
);
const LandingFooter = lazy(() =>
  import("@/components/landing/LandingFooter").then((m) => ({ default: m.LandingFooter }))
);

function SectionFallback() {
  return (
    <div className="py-16 flex items-center justify-center" aria-hidden="true">
      <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthRedirect("/dashboard");

  useEffect(() => {
    document.title = "FisioGest Pro — Sistema Completo para Gestão de Clínicas";
  }, []);

  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading || isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-[#060f1e] flex items-center justify-center"
        aria-live="polite"
        aria-label="Carregando..."
      >
        <div className="w-10 h-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <LandingHeader />

      <main id="main-content">
        <HeroSection onScrollTo={scrollTo} />
        <StatsSection />

        <Suspense fallback={<SectionFallback />}>
          <ProblemsSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <SolutionSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <FeaturesSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <BenefitsSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <PricingSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <TestimonialsSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <FAQSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <CTASection />
        </Suspense>
      </main>

      <Suspense fallback={<SectionFallback />}>
        <LandingFooter />
      </Suspense>
    </div>
  );
}
