"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  BarChart3,
  FileSpreadsheet,
  Award,
  Sun,
  Moon,
} from "lucide-react";

interface AuthSplitShellProps {
  children: React.ReactNode;
}

export function AuthSplitShell({ children }: AuthSplitShellProps) {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== "undefined" ? localStorage.getItem("pncp_theme") : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (saved === "dark" || (!saved && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (typeof window !== "undefined") {
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("pncp_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("pncp_theme", "light");
      }
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Editorial Showcase (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-[#0A1528] via-[#112240] to-[#1B365D] text-white relative overflow-hidden border-r border-[#B59410]/30 select-none">
        {/* Subtle radial gold glow & architectural grid background pattern */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-15 [background-image:radial-gradient(circle_at_top_right,rgba(212,175,55,0.4),transparent_50%),radial-gradient(rgba(212,175,55,0.2)_1px,transparent_1px)] [background-size:100%_100%,24px_24px]"
        />

        {/* Top Brand Crest */}
        <div className="relative z-10 flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0F2442]/90 flex items-center justify-center shadow-lg border border-[#D4AF37]/40 shrink-0">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/30 mb-1">
              Lei nº 14.133/2021 • IN SEGES/ME nº 65/2021
            </span>
            <h1 className="font-heading text-xl font-bold tracking-tight text-white">
              Pesquisa de Preços no PNCP
            </h1>
            <p className="text-xs text-slate-300">
              Governança, Conformidade e Rastreabilidade em Contratações Públicas
            </p>
          </div>
        </div>

        {/* Central Hero Copy & 3 Architectural Feature Cards */}
        <div className="relative z-10 my-8 space-y-6">
          <div>
            <h2 className="font-heading text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Pesquisa de Preços com <span className="text-[#D4AF37]">Rigor Metodológico</span> e Auditoria Automatizada
            </h2>
            <p className="mt-2 text-xs xl:text-sm text-slate-300 leading-relaxed">
              Consulte Atas de Registro de Preços do Portal Nacional de Contratações Públicas com filtragem estrita, expurgo estatístico auditável e conformidade com os regulamentos federais.
            </p>
          </div>

          <div className="space-y-3.5">
            {/* Card 1: Auditoria R1-R7 */}
            <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1B365D] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Scale className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Auditoria Automática R1–R7
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Validação estrita de esfera, vigência (<code className="font-mono text-[11px] text-[#F3E5AB]">America/Recife</code>), municípios ≥ R$ 1 bilhão e unidade homologada.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Saneamento Estatístico */}
            <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1B365D] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Saneamento Estatístico
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Expurgo assistido de outliers por Intervalo Interquartil (IQR) e Mediana com memória de cálculo.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Exportação Tripla Auditável */}
            <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1B365D] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Exportação Tripla Auditável
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Emissão imediata de planilha Excel (<code className="font-mono text-[11px] text-[#F3E5AB]">.xlsx</code> A4 com fórmulas), Relatório Técnico em PDF e CSV.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Independent Initiative Disclaimer Box */}
        <div className="relative z-10 p-4 rounded-xl bg-[#0A1528]/80 border border-[#D4AF37]/30 shadow-inner">
          <div className="flex items-start gap-2.5">
            <Award className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Iniciativa pessoal e independente idealizada e desenvolvida por <span className="text-white font-semibold">Sérgio Dantas Torres</span> para apoio técnico à pesquisa de preços. Esta aplicação privada não possui vínculo institucional, representação, chancela ou patrocínio oficial de órgãos públicos.
            </p>
          </div>
        </div>
      </aside>

      {/* Right Form Area */}
      <main className="lg:col-span-7 flex flex-col justify-between min-h-screen bg-gov-mesh px-4 sm:px-6 lg:px-12 py-6">
        {/* Top Bar with Mobile Brand Header & Dark Mode Toggle */}
        <header className="flex items-center justify-between w-full max-w-md mx-auto lg:max-w-none">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1B365D] to-[#0A1528] flex items-center justify-center border border-[#D4AF37]/40 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <span className="block font-heading text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Pesquisa de Preços no PNCP
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Lei nº 14.133/2021
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            {/* Desktop spacer or home link */}
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              ← Voltar à página inicial
            </Link>
          </div>

          {/* Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label="Alternar tema claro ou escuro"
            className="min-h-[44px] min-w-[44px] cursor-pointer inline-flex items-center justify-center rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF37]"
            title={mounted && darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {mounted && darkMode ? (
              <Sun className="w-5 h-5 text-[#D4AF37]" />
            ) : (
              <Moon className="w-5 h-5 text-[#1B365D]" />
            )}
          </button>
        </header>

        {/* Centered Form Card */}
        <div className="max-w-md w-full mx-auto my-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8">
          {children}
        </div>

        {/* Bottom Compact Disclaimer for Mobile */}
        <footer className="lg:hidden text-center max-w-md mx-auto pt-4 pb-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Iniciativa pessoal e independente idealizada e desenvolvida por Sérgio Dantas Torres para apoio técnico à pesquisa de preços. Esta aplicação privada não possui vínculo institucional, representação, chancela ou patrocínio oficial de órgãos públicos.
          </p>
        </footer>
      </main>
    </div>
  );
}
